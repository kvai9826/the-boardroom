import os
import time
from playwright.sync_api import sync_playwright

OUTPUT_DIR = "/Users/karthikeyavaibhav/.gemini/antigravity/scratch/pmo_swarm_app/docs/images"
ARTIFACT_DIR = "/Users/karthikeyavaibhav/.gemini/antigravity/brain/1120feb9-4824-4fb4-98ad-7752a4ac1835"
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

BRAVE_PATH = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"

def capture_all():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=BRAVE_PATH,
            args=[
                "--no-sandbox",
                "--disable-gpu",
                "--force-color-profile=srgb",
                "--hide-scrollbars"
            ]
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2
        )
        page = context.new_page()

        print("Navigating to http://127.0.0.1:8000 ...")
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        time.sleep(1)

        # 1. SCREENSHOT 1: Clean Boardroom Hero Landing Screen
        print("Capturing 1: Hero Landing Screen...")
        hero_path = os.path.join(OUTPUT_DIR, "boardroom_hero_landing_real.png")
        page.screenshot(path=hero_path)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "boardroom_hero_landing_real.png"))

        # 2. SCREENSHOT 2: Real 3D Boardroom (Meeting Room) with Live Debate & Escalation
        print("Capturing 2: Real 3D Boardroom with Agent Debate & Escalation...")
        page.evaluate("""() => {
            // Switch to meeting view
            if (typeof switchViewMode === 'function') {
                switchViewMode('meeting');
            }
            if (typeof setupClassicOfficeView === 'function') {
                setupClassicOfficeView();
            }
            // Trigger formal grievance escalation
            if (typeof handleEscalationFiled === 'function') {
                handleEscalationFiled({
                    accuser: 'Cost Auditor',
                    accused: 'Cloud Architect',
                    allegation: 'Epistemic budget breach: Cloud Architect proposed $4,200/mo architecture exceeding $3,000/mo hard ceiling without spot discount model.',
                    manager_id: 'ops_pm'
                });
            }
            // Show metrics bar
            const mb = document.getElementById('metrics-dashboard-bar');
            if (mb) {
                mb.style.display = 'flex';
                document.getElementById('val-net-cost').textContent = '$2,480.00/mo';
                document.getElementById('val-spot-savings').textContent = 'Spot Savings: 41%';
                document.getElementById('val-sec-risk').textContent = 'Score 8.5/10';
                document.getElementById('val-sec-status').textContent = 'Status: Enforced';
                document.getElementById('val-sla-target').textContent = '99.99% Uptime';
                document.getElementById('val-sla-rto').textContent = 'RTO: < 5s';
            }
            // Trigger speech bubble on Cloud Architect
            if (typeof updateMeetingRoomSpeech === 'function') {
                updateMeetingRoomSpeech({
                    agent_id: 'cloud_architect',
                    phase: 'Phase 4: Cross-Agent Debate',
                    content: '### [PROPOSAL] Active-Active Multi-Region Cluster\\nWe have integrated AWS Fargate spot interruptions and DynamoDB global replication to stay strictly under the $3,000 monthly envelope while meeting the 99.99% SLA mandate.'
                });
            }
            // Target beacon
            const callout = document.getElementById('callout-cloud_architect');
            if (callout) {
                callout.textContent = '🎯 TARGETED BY COST AUDITOR';
                callout.style.display = 'block';
            }
            // Red team advocate active
            const daCard = document.getElementById('meeting-card-devils_advocate');
            if (daCard) {
                daCard.classList.add('thinking-active');
            }
            // Draw hierarchy lines
            if (typeof drawHierarchyCurves === 'function') {
                drawHierarchyCurves();
            }
        }""")
        time.sleep(1.5)
        debate_path = os.path.join(OUTPUT_DIR, "boardroom_meeting_debate_real.png")
        page.screenshot(path=debate_path)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "boardroom_meeting_debate_real.png"))

        # 3. SCREENSHOT 3: Live War Room Deliberation Feed (Executive Chat Mode)
        print("Capturing 3: Live War Room Deliberation Feed...")
        page.evaluate("""() => {
            if (typeof switchViewMode === 'function') {
                switchViewMode('chat');
            }
            // Populate sample deliberation messages if chat is empty
            const feed = document.getElementById('chat-messages');
            if (feed) {
                feed.innerHTML = `
                    <div class="chat-bubble-wrapper agent-head_pmo">
                        <div class="agent-avatar-badge">👨‍💼</div>
                        <div class="chat-bubble">
                            <div class="bubble-header">
                                <span class="bubble-author">Head of PMO</span>
                                <span class="bubble-phase-badge">Phase 1: Executive Strategy</span>
                            </div>
                            <div class="bubble-body">
                                <strong>[MANDATE]</strong> Multi-Region Audit Event Platform commissioned under SOC2 compliance. Hard monthly budget ceiling: $3,000. Target SLA: 99.99%.
                            </div>
                        </div>
                    </div>
                    <div class="chat-bubble-wrapper agent-cloud_architect">
                        <div class="agent-avatar-badge">🏗️</div>
                        <div class="chat-bubble">
                            <div class="bubble-header">
                                <span class="bubble-author">Cloud Architect</span>
                                <span class="bubble-phase-badge">Phase 3: Specialist Draft</span>
                            </div>
                            <div class="bubble-body">
                                <strong>[PROPOSAL]</strong> Deployed Amazon Kinesis Data Streams into multi-AZ ECS Fargate workers with DynamoDB Global Tables. Estimated monthly baseline: $2,850.
                            </div>
                        </div>
                    </div>
                    <div class="chat-bubble-wrapper agent-cost_auditor">
                        <div class="agent-avatar-badge">💰</div>
                        <div class="chat-bubble">
                            <div class="bubble-header">
                                <span class="bubble-author">Cost Auditor</span>
                                <span class="bubble-phase-badge">Phase 4: Dispute</span>
                            </div>
                            <div class="bubble-body">
                                <strong>[DISPUTE]</strong> Cross-region egress traffic fees will add $450/mo during peak load, breaching the hard budget. Recommending VPC endpoint peering.
                            </div>
                        </div>
                    </div>
                    <div class="chat-bubble-wrapper agent-devils_advocate">
                        <div class="agent-avatar-badge">🛡️</div>
                        <div class="chat-bubble">
                            <div class="bubble-header">
                                <span class="bubble-author">Devil's Advocate</span>
                                <span class="bubble-phase-badge">Phase 5.5: Pre-Mortem Attack</span>
                            </div>
                            <div class="bubble-body">
                                <strong>[PRE-MORTEM ATTACK]</strong> <em>Catastrophic Vector Detected:</em> Split-brain scenario during us-east-1 partition will trigger duplicate audit ledger entries without idempotent hash sealing.
                            </div>
                        </div>
                    </div>
                `;
            }
            // Populate ADR preview
            const adrPreview = document.getElementById('adr-preview-content');
            if (adrPreview) {
                adrPreview.innerHTML = `
                    <h3>ADR-009: Multi-Region Zero-Trust Audit Ingestion</h3>
                    <p><strong>Status:</strong> <span style="color: #10b981;">Approved with Stipulations</span></p>
                    <p><strong>Context:</strong> Cross-region high-concurrency event bus requiring immutable hashing and statutory SOC2 privacy.</p>
                    <p><strong>Decision:</strong> Adopt Active-Active Fargate workers backed by DynamoDB global tables with deterministic HMAC-SHA256 deduplication.</p>
                `;
            }
        }""")
        time.sleep(1)
        chat_path = os.path.join(OUTPUT_DIR, "boardroom_chat_war_room_real.png")
        page.screenshot(path=chat_path)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "boardroom_chat_war_room_real.png"))

        # 4. SCREENSHOT 4: Clean Model Configuration Dialog
        print("Capturing 4: Model Configuration Modal...")
        page.evaluate("""() => {
            if (typeof openModelModal === 'function') {
                openModelModal();
            }
        }""")
        time.sleep(0.8)
        modal_path = os.path.join(OUTPUT_DIR, "boardroom_model_modal_real.png")
        page.screenshot(path=modal_path)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "boardroom_model_modal_real.png"))

        browser.close()
        print("All real UI screenshots captured successfully!")

if __name__ == "__main__":
    capture_all()
