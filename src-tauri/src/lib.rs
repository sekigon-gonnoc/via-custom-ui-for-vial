use std::{collections::HashMap, ffi::CString, sync::Mutex};

use hidapi::{HidApi, HidDevice};
use serde::{Deserialize, Serialize};
use tauri_plugin_log::{Target, TargetKind};

#[derive(Serialize, Deserialize)]
struct HidDeviceId {
    path: String,
    label: String,
}

#[derive(Serialize, Deserialize)]
struct HidDeviceFilter {
    vendor_id: Option<u16>,
    product_id: Option<u16>,
    usage_page: Option<u16>,
    usage: Option<u16>,
}

struct HidDeviceState {
    dict: Mutex<HashMap<String, HidDevice>>,
}

fn new_hidapi() -> HidApi {
    HidApi::new().expect("Failed to create `HidApi`")
}

#[tauri::command]
fn hid_request_device(filters: Vec<HidDeviceFilter>) -> Vec<HidDeviceId> {
    println!("request_device()");
    let hidapi = new_hidapi();
    let devs: Vec<_> = hidapi.device_list().collect();
    devs.iter()
        .filter(|d| {
            filters.iter().any(|filter| {
                (filter.usage.is_none() || filter.usage.unwrap() == d.usage())
                    && (filter.usage_page.is_none() || filter.usage_page.unwrap() == d.usage_page())
                    && (filter.vendor_id.is_none() || filter.vendor_id.unwrap() == d.vendor_id())
                    && (filter.product_id.is_none() || filter.product_id.unwrap() == d.product_id())
            })
        })
        .map(|d| HidDeviceId {
            path: d.path().to_str().unwrap().to_string(),
            label: format!(
                "{}({:04X}:{:04X})({:?})",
                d.product_string().unwrap_or(""),
                d.vendor_id(),
                d.product_id(),
                d.bus_type()
            ),
        })
        .collect()
}

#[tauri::command]
fn hid_open_device(
    device: HidDeviceId,
    state: tauri::State<'_, HidDeviceState>,
) -> Result<(), String> {
    let hidapi = new_hidapi();
    let hidres = hidapi.open_path(CString::new(device.path.as_str()).unwrap().as_c_str());

    match hidres {
        Err(e) => Err(format!("{:?}", e)),
        Ok(dev) => {
            state.dict.lock().unwrap().entry(device.path).or_insert(dev);
            Ok(())
        }
    }
}

#[tauri::command]
fn hid_write(
    device: HidDeviceId,
    data: Vec<u8>,
    state: tauri::State<'_, HidDeviceState>,
) -> Result<(), String> {
    match state
        .dict
        .lock()
        .unwrap()
        .get(&device.path)
        .unwrap()
        .write(&data)
    {
        Err(e) => Err(format!("{:?}", e)),
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
        .dict
        .lock()
        .unwrap()
        .get(&device.path)
        .unwrap()
        .read(&mut buf)
    {
        Err(e) => Err(format!("{:?}", e)),
        Ok(size) => Ok(buf[0..size].into()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::LogDir { file_name: None }),
            Target::new(TargetKind::Webview),
        ]).build())
        .manage(HidDeviceState {
            dict: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            hid_request_device,
            hid_open_device,
            hid_write,
            hid_read
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
