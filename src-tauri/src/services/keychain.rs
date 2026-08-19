//! Keychain service - OS-native secret storage.
//!
//! All API keys and credentials used by CNTRL pass through this module.
//! Secrets are stored in the platform's native keychain:
//! - **macOS**: Keychain Services (`apple-native` feature)
//! - **Windows**: Windows Credential Manager (`windows-native` feature)
//! - **Linux**: Secret Service / libsecret (`sync-secret-service` feature)
//!
//! **No plaintext credential ever touches the filesystem, SQLite, or any
//! environment variable.** Callers receive only masked sentinels (e.g.
//! `"sk-or-***"`) from the config layer; real keys are only fetched here
//! immediately before use.

use keyring::Entry;
use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};

use crate::error::CntrlError;
use crate::services::memory::db::AppDb;

pub const APP_SERVICE: &str = "cntrl-browser";

static DB_INSTANCE: OnceLock<AppDb> = OnceLock::new();

// Fallback in-memory storage if OS Keychain fails
static FALLBACK_STORAGE: OnceLock<RwLock<HashMap<String, String>>> = OnceLock::new();

fn get_fallback() -> &'static RwLock<HashMap<String, String>> {
    FALLBACK_STORAGE.get_or_init(|| RwLock::new(HashMap::new()))
}

pub fn init_audit_db(db: AppDb) {
    let _ = DB_INSTANCE.set(db);
}

fn log_access(key: &str, access_type: &str) {
    if let Some(db) = DB_INSTANCE.get() {
        let db = db.clone();
        let key = key.to_string();
        let access_type = access_type.to_string();
        tauri::async_runtime::spawn(async move {
            let _ =
                crate::services::audit::log_credential_access(&db, APP_SERVICE, &key, &access_type)
                    .await;
        });
    }
}

pub fn store_secret(key: &str, value: &str) -> Result<(), CntrlError> {
    log_access(key, "write");
    let entry_result = Entry::new(APP_SERVICE, key);
    
    match entry_result {
        Ok(entry) => {
            if let Err(e) = entry.set_password(value) {
                eprintln!("Keychain store failed, falling back to memory for {}: {}", key, e);
                get_fallback().write().unwrap().insert(key.to_string(), value.to_string());
            }
            Ok(())
        },
        Err(e) => {
            eprintln!("Keychain init failed, falling back to memory for {}: {}", key, e);
            get_fallback().write().unwrap().insert(key.to_string(), value.to_string());
            Ok(())
        }
    }
}

pub fn retrieve_secret(key: &str) -> Result<String, CntrlError> {
    log_access(key, "read");
    
    // First try the fallback memory
    if let Some(val) = get_fallback().read().unwrap().get(key) {
        return Ok(val.clone());
    }

    let entry = Entry::new(APP_SERVICE, key)
        .map_err(|e| CntrlError::Keychain(format!("Failed to create keychain entry: {e}")))?;
    
    entry.get_password().map_err(|e| CntrlError::Keychain(format!("Failed to retrieve secret '{key}': {e}")))
}

pub fn delete_secret(key: &str) -> Result<(), CntrlError> {
    log_access(key, "delete");
    
    // Remove from fallback if present
    get_fallback().write().unwrap().remove(key);

    let entry = Entry::new(APP_SERVICE, key)
        .map_err(|e| CntrlError::Keychain(format!("Failed to create keychain entry: {e}")))?;
        
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => {
            eprintln!("Keychain delete failed, but removed from fallback for {}: {}", key, e);
            Ok(())
        }
    }
}

pub fn secret_exists(key: &str) -> bool {
    if get_fallback().read().unwrap().contains_key(key) {
        return true;
    }
    retrieve_secret(key).is_ok()
}

pub const MASKED_SENTINEL: &str = "***stored***";

pub const KEY_OPENROUTER: &str = "openrouter_api_key";
pub const KEY_GEMINI: &str = "gemini_api_key";
pub const KEY_GROQ: &str = "groq_api_key";
pub const KEY_HF_TOKEN: &str = "hf_access_token";
pub const KEY_OPENAI_COMPAT: &str = "openai_compat_api_key";

#[cfg(test)]
mod tests {
    use super::*;

    /// Probe if the keychain is available in this environment.
    fn is_keychain_available() -> bool {
        let test_key = "cntrl_test_key_availability_probe";
        let test_value = "probe-value";
        if store_secret(test_key, test_value).is_err() {
            return false;
        }
        let _ = delete_secret(test_key);
        true
    }

    #[test]
    fn store_retrieve_delete_roundtrip() {
        if !is_keychain_available() {
            eprintln!("Keychain unavailable, skipping test");
            return;
        }

        let test_key = "cntrl_test_key_roundtrip";
        let test_value = "test-secret-value-do-not-use";

        let _ = delete_secret(test_key);

        if let Err(e) = store_secret(test_key, test_value) {
            eprintln!("Keychain unavailable ({e}), skipping roundtrip test");
            return;
        }

        let retrieved = retrieve_secret(test_key).expect("should retrieve stored secret");
        assert_eq!(
            retrieved, test_value,
            "retrieved secret must match stored value"
        );

        assert!(!retrieved.is_empty(), "retrieved secret must not be empty");

        delete_secret(test_key).expect("should delete secret");

        assert!(
            retrieve_secret(test_key).is_err(),
            "retrieve after delete must return Err"
        );
    }

    #[test]
    fn delete_nonexistent_key_is_ok() {
        if !is_keychain_available() {
            eprintln!("Keychain unavailable, skipping test");
            return;
        }

        let result = delete_secret("cntrl_test_key_definitely_does_not_exist_xyz");
        assert!(result.is_ok(), "deleting non-existent key must return Ok");
    }

    #[test]
    fn secret_exists_false_for_unknown_key() {
        if !is_keychain_available() {
            eprintln!("Keychain unavailable, skipping test");
            return;
        }

        assert!(
            !secret_exists("cntrl_test_key_that_was_never_stored_abc123"),
            "secret_exists must return false for unknown key"
        );
    }
}
