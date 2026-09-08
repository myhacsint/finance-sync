"""Private bounded document worker. Deploy with network=none and no secret/data mounts."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import shutil
import sys

ROOT = Path(os.environ.get("FINANCE_PARSER_WORK_DIR", "/parser-work"))
QUEUE = ROOT / ".queue"
COMMANDS = {"qpdf", "pdfinfo", "pdftotext", "pdftoppm", "tesseract", "convert", "identify"}
LIMIT = 8 * 1024 * 1024


def execute(request):
    data = json.loads(request.read_text())
    command = data["command"]
    args = data["args"]
    if command not in {"/usr/bin/" + name for name in COMMANDS}:
        raise ValueError("SECURITY_PARSER_COMMAND")
    if not isinstance(args, list) or len(args) > 64 or not all(isinstance(a, str) and len(a) < 4096 for a in args):
        raise ValueError("SECURITY_PARSER_ARGUMENTS")
    timeout = min(60, (data["expiresAt"] - time.time() * 1000) / 1000)
    if timeout <= 0:
        raise ValueError("SECURITY_PARSER_TIMEOUT")
    # No shell. Private output files and RLIMIT_FSIZE bound captured output.
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        child = subprocess.Popen([
            "/usr/bin/prlimit", "--as=536870912", "--cpu=60", "--nproc=32",
            "--fsize=" + str(LIMIT), "--", command, *args
        ], stdout=out, stderr=err, start_new_session=True, env={
            "PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "TMPDIR": "/tmp"
        })
        try:
            code = child.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, 9)
            child.wait()
            raise ValueError("SECURITY_PARSER_TIMEOUT")
        out.seek(0)
        err.seek(0)
        stdout = out.read(LIMIT).decode("utf-8", "replace")
        stderr = err.read(LIMIT).decode("utf-8", "replace")
        if code:
            return {"error": "PDF_ENCRYPTED" if "password" in stderr.lower() else "SECURITY_PARSER_FAILED", "stdout": "", "stderr": ""}
        return {"stdout": stdout, "stderr": stderr}


def main():
    os.umask(0o077)
    QUEUE.mkdir(parents=True, exist_ok=True, mode=0o700)
    while True:
        (QUEUE / "heartbeat").touch()
        for request in sorted(QUEUE.glob("*.request")):
            try:
                output = execute(request)
            except Exception as error:
                code = str(error) if str(error) in {"SECURITY_PARSER_TIMEOUT", "SECURITY_PARSER_COMMAND", "SECURITY_PARSER_ARGUMENTS"} else "SECURITY_PARSER_FAILED"
                output = {"error": code, "stdout": "", "stderr": ""}
            target = request.with_suffix(".result")
            # The caller may have timed out while parsing; do not recreate its job.
            if request.exists():
                temp = target.with_suffix(".tmp")
                temp.write_text(json.dumps(output))
                temp.replace(target)
            request.unlink(missing_ok=True)
            (QUEUE / "heartbeat").touch()
        # Expired results contain extracted text and must not linger after a caller crash.
        for path in QUEUE.iterdir():
            try:
                if path.suffix in {".result", ".tmp"} and time.time() - path.stat().st_mtime > 120:
                    path.unlink(missing_ok=True)
            except FileNotFoundError:
                pass
        # Only known upload work directories; never follow links or touch the queue.
        for path in ROOT.iterdir():
            try:
                if path.name.startswith(("finance-pension-", "finance-sutor-", "finance-card-")) and not path.is_symlink() and path.is_dir() and time.time() - path.stat().st_mtime > 3600:
                    shutil.rmtree(path)
            except FileNotFoundError:
                pass
        time.sleep(0.1)


if __name__ == "__main__":
    if "--health" in sys.argv:
        try:
            sys.exit(0 if time.time() - (QUEUE / "heartbeat").stat().st_mtime < 90 else 1)
        except OSError:
            sys.exit(1)
    main()
