use std::{
    collections::HashMap,
    ffi::CString,
    io::Write,
    sync::{atomic::AtomicBool, Arc, Mutex},
};

use hidapi::{DeviceInfo, HidApi, HidDevice};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_log::{Target, TargetKind};

#[derive(Serialize, Deserialize)]
struct HidDeviceId {
    path: String,
    #[serde(rename = "reportId")]
    report_id: u8,
}

#[derive(Serialize, Deserialize)]
struct HidDeviceListItem {
    name: String,
    vid: u16,
    pid: u16,
    opened: bool,
    usage: [u16; 1],
    #[serde(rename = "usagePage")]
    usage_page: [u16; 1],
}

#[derive(Serialize, Deserialize)]
struct HidDeviceFilter {
    vendor_id: Option<u16>,
    product_id: Option<u16>,
    usage_page: Option<u16>,
    usage: Option<u16>,
}

#[derive(Serialize, Deserialize, Clone)]
struct InputReport {
    path: String,
    data: Vec<u8>,
}

struct ActiveHidDevice {
    device: HidDevice,
    read_loop_running: Arc<AtomicBool>,
}

struct HidDeviceState {
    active: Mutex<HashMap<String, ActiveHidDevice>>,
    device_list: Mutex<Vec<String>>,
}

fn new_hidapi() -> HidApi {
    HidApi::new().expect("Failed to create `HidApi`")
}

fn get_report_id(hid: &HidDevice) -> u8 {
    let mut desc = [0u8; hidapi::MAX_REPORT_DESCRIPTOR_SIZE];
    let size = hid.get_report_descriptor(&mut desc).unwrap_or(0);

    let mut idx = 0;
    while idx < size {
        let item = desc[idx];
        if item == 0x85 {
            return *desc.get(idx + 1).unwrap_or(&0);
        }

        idx = match item & 0x03 {
            0 => idx + 1,
            1 => idx + 2,
            2 => idx + 3,
            3 => idx + 4,
            _ => idx + 1,
        };
    }

    return 0;
}

#[tauri::command]
fn hid_get_devices(state: tauri::State<'_, HidDeviceState>) -> Vec<HidDeviceListItem> {
    println!("get_devices()");
    let hidapi = new_hidapi();
    let devs: Vec<_> = hidapi.device_list().collect();
    let list = devs
        .iter()
        .map(|d| HidDeviceListItem {
            name: d.product_string().unwrap_or("").to_string(),
            vid: d.vendor_id(),
            pid: d.product_id(),
            opened: state
                .active
                .lock()
                .unwrap()
                .contains_key(&d.path().to_str().unwrap_or("").to_string()),
            usage: [d.usage()],
            usage_page: [d.usage_page()],
        })
        .collect();
    state.device_list.lock().unwrap().clear();

    let mut paths: Vec<String> = devs
        .iter()
        .map(|d| d.path().to_str().unwrap_or("").to_string())
        .collect();
    state.device_list.lock().unwrap().append(&mut paths);
    list
}

#[tauri::command]
fn hid_open_device(
    device_index: usize,
    app: AppHandle,
    state: tauri::State<'_, HidDeviceState>,
) -> Result<HidDeviceId, String> {
    let hidapi = new_hidapi();
    let path = CString::new(
        state
            .device_list
            .lock()
            .unwrap()
            .get(device_index)
            .unwrap()
            .as_str(),
    )
    .unwrap();

    if let Some((path, active_hid)) = state
        .active
        .lock()
        .unwrap()
        .get_key_value(&path.to_str().unwrap().to_string())
    {
        if (active_hid
            .read_loop_running
            .load(std::sync::atomic::Ordering::SeqCst))
        {
            println!("{} is already opened", path);
            let report_id = get_report_id(&active_hid.device);
            return Ok(HidDeviceId {
                path: path.clone(),
                report_id: report_id,
            });
        }
    }

    println!("Open {:?}", path);

    let path2 = path.clone();
    let hidres = hidapi.open_path(path.as_c_str());

    match hidres {
        Err(e) => Err(format!("{:?}", e)),
        Ok(dev) => {
            let report_id = get_report_id(&dev);
            state.active.lock().unwrap().insert(
                path.to_str().unwrap().to_string(),
                ActiveHidDevice {
                    device: dev,
                    read_loop_running: Arc::new(AtomicBool::new(true)),
                },
            );

            let flag_cloned = if let Some((_, active_hid)) = state
                .active
                .lock()
                .unwrap()
                .get_key_value(&path.to_str().unwrap().to_string())
            {
                active_hid
                    .read_loop_running
                    .store(true, std::sync::atomic::Ordering::SeqCst);
                Some(active_hid.read_loop_running.clone())
            } else {
                None
            };

            std::thread::spawn(move || {
                let hidres = hidapi.open_path(path.as_c_str());
                if let Ok(dev) = hidres {
                    println!("start read loop");
                    let flag = flag_cloned.unwrap();
                    loop {
                        let mut buf = [0u8; 65];
                        let res = dev.read(&mut buf).and_then(|d| {
                            // println!("report received");
                            app.emit(
                                "oninputreport",
                                InputReport {
                                    path: path.to_str().unwrap().to_string(),
                                    data: buf[0..d].into(),
                                },
                            )
                            .unwrap();
                            Ok(())
                        });

                        if let Err(e) = res {
                            flag.store(false, std::sync::atomic::Ordering::SeqCst);
                            println!("{:?}", e);
                        };

                        if !flag.load(std::sync::atomic::Ordering::SeqCst) {
                            app.emit(
                                "onclose",
                                InputReport {
                                    path: path.to_str().unwrap().to_string(),
                                    data: [].into(),
                                },
                            );
                            return;
                        }
                    }
                }
            });
            Ok(HidDeviceId {
                path: path2.to_str().unwrap().to_string(),
                report_id: report_id,
            })
        }
    }
}

#[tauri::command]
fn hid_write(
    device: String,
    data: Vec<u8>,
    state: tauri::State<'_, HidDeviceState>,
) -> Result<(), String> {
    match state
        .active
        .lock()
        .unwrap()
        .get(&device)
        .unwrap()
        .device
        .write(&data)
    {
        Err(e) => {
            println!("fail");
            Err(format!("{:?}", e))
        }
        Ok(_s) => Ok(()),
    }
}

#[tauri::command]
fn hid_read(
    device: HidDeviceId,
    state: tauri::State<'_, HidDeviceState>,
) -> Result<Vec<u8>, String> {
    let mut buf = [0u8; 65];
    match state
        .active
        .lock()
        .unwrap()
        .get(&device.path)
        .unwrap()
        .device
        .read(&mut buf)
    {
        Err(e) => Err(format!("{:?}", e)),
        Ok(size) => Ok(buf[0..size].into()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .manage(HidDeviceState {
            active: Mutex::new(HashMap::new()),
            device_list: Mutex::new(Vec::<String>::new()),
        })
        .invoke_handler(tauri::generate_handler![
            hid_get_devices,
            hid_open_device,
            hid_write,
            hid_read
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
