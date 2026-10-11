"""
FastAPI Server for PMO Agent Swarm Web Application
Provides WebSockets for real-time visual streaming and REST APIs for configuration.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
import asyncio
import json
import logging
import os
import time
import datetime
from typing import Dict, List, Any, Optional

from config import MODEL_TIER_CONFIG, AGENTS, OPENROUTER_GEMMA_MODELS, DEFAULT_OPENROUTER_URL
from swarm_engine import SwarmEngine
from pdf_exporter import generate_executive_pdf
import agentic_tools

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("PMOApp")

class ExportPDFRequest(BaseModel):
    prompt: Optional[str] = None
    adr: Optional[str] = None
    transcripts: Optional[List[Dict[str, Any]]] = None
    repo_slug: Optional[str] = None

app = FastAPI(title="Google-Styled PMO Agent Swarm", version="1.0.0")

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Initialize Swarm Engine
engine = SwarmEngine()

# Active WebSocket Connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total active: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

# Hook engine broadcast callback to ConnectionManager
async def swarm_broadcast_callback(event: Dict[str, Any]):
    await manager.broadcast(event)

engine.broadcast_callback = swarm_broadcast_callback

# Request Models
class InitiativeRequest(BaseModel):
    prompt: str
    mode: str = "dynamic"

class TierConfigUpdate(BaseModel):
    provider: str = None
    openrouter_api_key: str = None
    api_key: str = None
    concurrency_limit: int = None
    tier1: Dict[str, Any] = None
    tier2: Dict[str, Any] = None
    tier3: Dict[str, Any] = None
    agents: Dict[str, Dict[str, Any]] = None

# API Routes
@app.get("/api/config")
async def get_config():
    masked_key = ""
    if engine.openrouter_api_key:
        if len(engine.openrouter_api_key) > 10:
            masked_key = engine.openrouter_api_key[:8] + "••••••••" + engine.openrouter_api_key[-4:]
        else:
            masked_key = "••••••••"
    return {
        "provider": engine.provider,
        "has_api_key": bool(engine.openrouter_api_key),
        "masked_api_key": masked_key,
        "concurrency_limit": engine.concurrency_limit,
        "openrouter_gemma_models": OPENROUTER_GEMMA_MODELS,
        "model_tiers": engine.tier_config,
        "agents": engine.agents
    }

@app.post("/api/config")
async def update_config(update: TierConfigUpdate):
    data = update.dict(exclude_unset=True)
    engine.update_tier_config(data)
    masked_key = ""
    if engine.openrouter_api_key:
        if len(engine.openrouter_api_key) > 10:
            masked_key = engine.openrouter_api_key[:8] + "••••••••" + engine.openrouter_api_key[-4:]
        else:
            masked_key = "••••••••"
    full_config = {
        "provider": engine.provider,
        "has_api_key": bool(engine.openrouter_api_key),
        "masked_api_key": masked_key,
        "concurrency_limit": engine.concurrency_limit,
        "openrouter_gemma_models": OPENROUTER_GEMMA_MODELS,
        "config": engine.tier_config,
        "agents": engine.agents
    }
    await manager.broadcast({"event_type": "config_updated", "data": full_config})
    return {"status": "success", **full_config}

@app.get("/api/openrouter/models")
async def get_openrouter_models(api_key: str = None):
    key = (api_key or engine.openrouter_api_key or "").strip()
    headers = {}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get("https://openrouter.ai/api/v1/models", headers=headers)
            if res.status_code == 200:
                data = res.json().get("data", [])
                gemma_models = []
                for m in data:
                    m_id = m.get("id", "")
                    if "gemma-4" in m_id.lower():
                        gemma_models.append({
                            "id": m_id,
                            "name": m.get("name", m_id),
                            "context_length": m.get("context_length", 262144),
                            "is_free": ":free" in m_id
                        })
                if gemma_models:
                    return {"status": "success", "models": gemma_models}
    except Exception as e:
        logger.warning(f"Failed to query OpenRouter models live: {e}")
    return {"status": "default", "models": OPENROUTER_GEMMA_MODELS}

@app.get("/api/agents")
async def get_agents():
    return {"agents": engine.agents}

from fastapi import UploadFile, File
import io

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported.")
    try:
        import pypdf
        contents = await file.read()
        pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
        extracted_text = []
        for i, page in enumerate(pdf_reader.pages):
            text = page.extract_text()
            if text:
                extracted_text.append(f"--- Page {i+1} ---\n{text}")
        full_text = "\n".join(extracted_text).strip()
        if not full_text:
            raise HTTPException(status_code=400, detail="No readable text found in PDF.")
        return {"filename": file.filename, "extracted_text": full_text, "char_count": len(full_text)}
    except Exception as e:
        logger.error(f"Error parsing PDF {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")

@app.get("/api/repos")
async def list_generated_repos():
    """List all autonomously generated repositories in generated_repos/"""
    base_dir = agentic_tools.BASE_REPOS_DIR
    repos = []
    if os.path.exists(base_dir):
        for name in sorted(os.listdir(base_dir)):
            full_p = os.path.join(base_dir, name)
            if os.path.isdir(full_p):
                file_info = agentic_tools.list_files(name)
                repos.append({
                    "slug": name,
                    "abs_path": full_p,
                    "total_files": file_info.get("total_files", 0),
                    "created_at": os.path.getctime(full_p)
                })
    return {"repos": repos}

@app.get("/api/repos/{slug}/files")
async def get_repo_files(slug: str):
    """Get file tree for a generated repo"""
    clean_slug = agentic_tools.sanitize_repo_name(slug)
    return agentic_tools.list_files(clean_slug)

@app.get("/api/repos/{slug}/file")
async def get_repo_file_content(slug: str, path: str):
    """Read a specific file in the generated repo"""
    clean_slug = agentic_tools.sanitize_repo_name(slug)
    res = agentic_tools.read_file(clean_slug, path)
    if res.get("status") != "success":
        raise HTTPException(status_code=404, detail=res.get("error", "File not found"))
    return res

class ShellCommandRequest(BaseModel):
    command: str

@app.post("/api/repos/{slug}/run")
async def run_command_in_repo(slug: str, req: ShellCommandRequest):
    """Run an arbitrary shell command in the repository sandbox"""
    clean_slug = agentic_tools.sanitize_repo_name(slug)
    res = await agentic_tools.run_command(clean_slug, req.command)
    return res

async def safe_run_pmo_initiative(prompt: str, mode: str = "dynamic"):
    try:
        logger.info(f"🚀 [INITIATIVE STARTED]: mode={mode}, prompt={prompt[:80]}...")
        await engine.run_pmo_initiative(prompt, mode)
        logger.info("🏁 [INITIATIVE COMPLETED]")
    except asyncio.CancelledError:
        logger.info("🛑 [INITIATIVE CANCELLED]")
    except Exception as e:
        logger.exception(f"❌ [INITIATIVE EXCEPTION]: {e}")
        engine.is_running = False
        await manager.broadcast({
            "event_type": "transcript",
            "data": {
                "agent_id": "head_pmo",
                "phase": "Error",
                "type": "speech",
                "content": f"⚠️ PMO Swarm encountered an error: {str(e)}"
            }
        })
        await manager.broadcast({"event_type": "status_update", "data": {"status": "completed", "message": f"Error: {str(e)}"}})

@app.post("/api/run")
async def start_initiative(req: InitiativeRequest, background_tasks: BackgroundTasks):
    logger.info(f"HTTP POST /api/run called: mode={req.mode}, prompt={req.prompt[:60]}...")
    if engine.is_running:
        logger.info("Restarting active initiative with new prompt...")
        engine.cancel()
        await asyncio.sleep(0.15)
    
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    engine.stop_requested = False
    background_tasks.add_task(safe_run_pmo_initiative, req.prompt, req.mode)
    return {"status": "started", "prompt": req.prompt, "mode": req.mode}

class RelaxationRequest(BaseModel):
    approved_percent: float = 7.0
    custom_note: str = ""

@app.post("/api/resolve_relaxation")
async def resolve_relaxation_endpoint(req: RelaxationRequest):
    engine.resolve_relaxation(req.approved_percent, req.custom_note)
    await manager.broadcast({
        "event_type": "relaxation_resolved",
        "data": {
            "approved_percent": req.approved_percent,
            "custom_note": req.custom_note,
            "message": f"Executive Ruling Applied: Granted {req.approved_percent:.1f}% budget adjustment."
        }
    })
    return {"status": "success", "approved_percent": req.approved_percent, "custom_note": req.custom_note}

@app.api_route("/api/export/pdf", methods=["GET", "POST"])
async def export_pdf(req: Optional[ExportPDFRequest] = None):
    """Generates and downloads a comprehensive executive PDF containing scorecard, ADR, full transcripts, and generated codebase."""
    try:
        req_transcripts = req.transcripts if req and req.transcripts else None
        req_adr = req.adr if req and req.adr else None
        req_prompt = req.prompt if req and req.prompt else None
        req_repo_slug = req.repo_slug if req and req.repo_slug else None

        prompt = req_prompt or engine.last_executive_request or "High-Throughput Enterprise Architecture & PMO Swarm Initiative"
        adr_text = req_adr or engine.latest_adr or ""
        transcripts = req_transcripts or engine.history_transcripts or []
        repo_slug = req_repo_slug or engine.latest_repo_slug or ""

        # If repo_slug is empty, look for the most recently created repository in BASE_REPOS_DIR
        if not repo_slug and os.path.exists(agentic_tools.BASE_REPOS_DIR):
            subdirs = [
                d for d in os.listdir(agentic_tools.BASE_REPOS_DIR)
                if os.path.isdir(os.path.join(agentic_tools.BASE_REPOS_DIR, d))
            ]
            if subdirs:
                subdirs.sort(key=lambda d: os.path.getmtime(os.path.join(agentic_tools.BASE_REPOS_DIR, d)), reverse=True)
                repo_slug = subdirs[0]

        # Disk recovery fallback for transcripts and ADR if empty in memory
        os.makedirs("session_records", exist_ok=True)
        session_file = os.path.join("session_records", f"{repo_slug}_session.json") if repo_slug else None
        latest_session_file = os.path.join("session_records", "latest_session.json")

        if not transcripts:
            for s_file in [session_file, latest_session_file]:
                if s_file and os.path.exists(s_file):
                    try:
                        with open(s_file, "r") as sf:
                            saved_data = json.load(sf)
                            if not transcripts and saved_data.get("transcripts"):
                                transcripts = saved_data["transcripts"]
                            if not adr_text and saved_data.get("adr"):
                                adr_text = saved_data["adr"]
                            if (not prompt or prompt == "High-Throughput Enterprise Architecture & PMO Swarm Initiative") and saved_data.get("prompt"):
                                prompt = saved_data["prompt"]
                    except Exception as err:
                        logger.warning(f"Failed to load session record from {s_file}: {err}")

        # If transcripts exist, persist to session_records for resilient reload
        if transcripts:
            try:
                record = {
                    "prompt": prompt,
                    "adr": adr_text,
                    "repo_slug": repo_slug,
                    "transcripts": transcripts,
                    "saved_at": datetime.datetime.now().isoformat()
                }
                with open(latest_session_file, "w") as sf:
                    json.dump(record, sf, indent=2)
                if repo_slug and session_file:
                    with open(session_file, "w") as sf:
                        json.dump(record, sf, indent=2)
            except Exception as e:
                logger.warning(f"Failed to persist session record: {e}")

        repo_files = []
        if repo_slug:
            files_res = agentic_tools.list_files(repo_slug)
            files_list = files_res.get("files", []) if isinstance(files_res, dict) else []
            for f in files_list:
                f_path = f.get("path")
                if f_path:
                    read_res = agentic_tools.read_file(repo_slug, f_path)
                    repo_files.append({
                        "path": f_path,
                        "content": read_res.get("content", ""),
                        "line_count": f.get("line_count", 0),
                        "size_bytes": f.get("size_bytes", 0)
                    })

        pdf_bytes = generate_executive_pdf(
            prompt=prompt,
            adr_text=adr_text,
            transcripts=transcripts,
            repo_slug=repo_slug,
            repo_files=repo_files,
            agents_meta=engine.agents,
            provider_name=f"{engine.provider.upper()} ({'OpenRouter' if engine.provider == 'openrouter' else 'LM Studio'})"
        )

        filename = f"The_Boardroom_Report_{repo_slug or 'Initiative'}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        logger.error(f"Error generating PDF report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF report: {str(e)}")

# WebSocket Endpoint for Real-time Streaming
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # Send initial status
    await websocket.send_json({"event_type": "init", "data": {"config": engine.tier_config, "agents": AGENTS}})
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming client messages if any
            try:
                msg = json.loads(data)
                action = msg.get("action")
                if action == "cancel":
                    engine.cancel()
                    await manager.broadcast({"event_type": "status_update", "data": {"status": "completed", "message": "Initiative stopped."}})
                elif action == "interject" or action == "executive_directive":
                    directive = msg.get("directive", "")
                    if directive and engine.add_executive_directive(directive):
                        await manager.broadcast({
                            "event_type": "executive_directive_applied",
                            "data": {
                                "directives": engine.executive_directives,
                                "latest": directive,
                                "message": f"⚡ Executive Override Applied: '{directive}'"
                            }
                        })
                        # Immediately inject a high-visibility speech event from Head of PMO into the war room feed
                        await manager.broadcast({
                            "event_type": "transcript",
                            "data": {
                                "agent_id": "head_pmo",
                                "phase": "Executive Interjection",
                                "type": "speech",
                                "content": f"⚡ [EXECUTIVE DIRECTIVE INTERJECTED BY LEADERSHIP]:\n\"{directive}\"\n\n📢 Attention all PMs and Specialists: Executive leadership has issued a binding constraint override. You MUST re-evaluate your trade-off calculations, performance projections, and financial models to incorporate this directive immediately."
                            }
                        })
                        # If engine was finished/idle, auto-restart run with directive applied
                        if not engine.is_running:
                            req_prompt = engine.last_executive_request or f"Re-evaluating initiative under directive: '{directive}'"
                            engine.stop_requested = False
                            asyncio.create_task(engine.run_pmo_initiative(req_prompt))
                elif action == "resolve_relaxation" or action == "grant_relaxation":
                    approved_pct = float(msg.get("approved_percent", 7.0))
                    custom_note = msg.get("custom_note", "")
                    engine.resolve_relaxation(approved_pct, custom_note)
                    await manager.broadcast({
                        "event_type": "relaxation_resolved",
                        "data": {
                            "approved_percent": approved_pct,
                            "custom_note": custom_note,
                            "message": f"Executive Ruling Applied: Granted {approved_pct:.1f}% budget adjustment."
                        }
                    })
                elif action == "clear_directives":
                    engine.clear_executive_directives()
                    await manager.broadcast({
                        "event_type": "executive_directive_applied",
                        "data": {"directives": [], "message": "Cleared all executive directives."}
                    })
                elif action == "run":
                    prompt = msg.get("prompt", "")
                    mode = msg.get("mode", "dynamic")
                    logger.info(f"WS run action received: mode={mode}, prompt={prompt[:60]}...")
                    if prompt:
                        now = time.time()
                        last_launch = getattr(engine, "_last_ws_launch_time", 0)
                        if now - last_launch < 1.0:
                            logger.warning("Duplicate WS run action received within 1s. Ignoring duplicate.")
                            continue
                        engine._last_ws_launch_time = now

                        if engine.is_running:
                            logger.info("Restarting active initiative via WS...")
                            engine.cancel()
                            await asyncio.sleep(0.15)
                        engine.stop_requested = False
                        asyncio.create_task(safe_run_pmo_initiative(prompt, mode))
            except Exception as e:
                logger.error(f"Error handling websocket message: {e}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Mount Static Files
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
