use std::sync::atomic::{AtomicBool, AtomicU32};

/// 跟踪我们是否启动了 pi serve 进程
pub struct ServiceState {
    /// 我们启动的子进程 PID
    pub child_pid: AtomicU32,
    /// 是否由我们启动（用于关闭时判断是否需要询问）
    pub we_started: AtomicBool,
}

impl Default for ServiceState {
    fn default() -> Self {
        Self {
            child_pid: AtomicU32::new(0),
            we_started: AtomicBool::new(false),
        }
    }
}
