"""개발 서버 실행."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        # Exclude generated/runtime files from the file-watcher so that saving
        # runtime_settings.json, writing a chat log, or creating a backup ZIP
        # does NOT trigger a server reload (which would kill in-flight requests).
        reload_excludes=[
            "runtime_settings.json",
            "logs/**",
            "backups/**",
            "*.json",
            "*.zip",
            "__pycache__/**",
            "*.pyc",
        ],
    )
