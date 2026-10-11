/**
 * The Boardroom — Autonomous Executive Swarm Frontend Script
 * Handles WebSockets streaming, PDF parsing, Landing Hero UI, 
 * Chat View vs. Visual Meeting Room ("Real Interaction"), and reactive agent states.
 */

let socket = null;
let currentAgents = {};
let currentConfig = {};
let activeFilter = 'all';

let selectedMode = 'chat'; // 'chat' or 'meeting'
let attachedPdfText = '';
let attachedPdfName = '';

document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  initEventListeners();
  loadConfig();
  initPdfUpload();
  setSwarmOrgMode('dynamic');
});

// WebSocket Connection Management
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  updateConnectionStatus('connecting', 'Connecting to LM Studio...');

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    updateConnectionStatus('connected', 'LM Studio Swarm Ready · Gemma 4 12B');
  };

  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    handleServerEvent(payload);
  };

  socket.onerror = (err) => {
    console.error('WebSocket Error:', err);
    updateConnectionStatus('disconnected', 'LM Studio Connection Error');
  };

  socket.onclose = () => {
    updateConnectionStatus('disconnected', 'Disconnected. Reconnecting in 3s...');
    setTimeout(initWebSocket, 3000);
  };
}

function updateConnectionStatus(state, text) {
  const chip = document.getElementById('connection-status');
  if (!chip) return;
  const dot = chip.querySelector('.status-dot');
  const label = document.getElementById('connection-text');

  dot.className = `status-dot ${state}`;
  if (state === 'connected') {
    const activeModel = (currentConfig.tier3 && currentConfig.tier3.model_name) || (currentConfig.tier1 && currentConfig.tier1.model_name) || 'Gemma 4';
    label.textContent = `LM Studio Swarm Ready · ${activeModel}`;
  } else {
    label.textContent = text || 'Disconnected';
  }
}

// Handle Server Events
function handleServerEvent(event) {
  const { event_type, data } = event;

  switch (event_type) {
    case 'init':
      currentAgents = data.agents;
      currentConfig = data.config;
      updateModelTags(data.config);
      break;

    case 'config_updated':
      currentConfig = data;
      updateModelTags(data);
      break;

    case 'status_update':
      handleStatusUpdate(data);
      break;

    case 'agent_status':
      updateAgentIndicator(data.agent_id, data.state);
      updateMeetingRoomAgentStatus(data.agent_id, data.state);
      break;

    case 'transcript':
      if (!window.activeSessionTranscripts) window.activeSessionTranscripts = [];
      window.activeSessionTranscripts.push(data);
      appendSpeechCard(data);
      updateMeetingRoomSpeech(data);
      break;

    case 'roster_commissioned':
      handleRosterCommissioned(data);
      break;

    case 'escalation_filed':
      handleEscalationFiled(data);
      break;

    case 'arbitration_verdict':
      handleArbitrationVerdict(data);
      break;

    case 'agent_fired':
      handleAgentFired(data);
      break;

    case 'agent_hired':
      handleAgentHired(data);
      break;

    case 'metrics_update':
      updateDashboardMetrics(data);
      break;

    case 'executive_directive_applied':
      handleDirectiveApplied(data);
      break;

    case 'executive_relaxation_requested':
      handleRelaxationRequested(data);
      break;

    case 'relaxation_resolved':
      handleRelaxationResolved(data);
      break;

    case 'tool_started':
      handleToolStarted(data);
      break;

    case 'tool_output':
      handleToolOutput(data);
      break;

    case 'repo_file_created':
      handleRepoFileCreated(data);
      break;

    case 'repo_state_update':
      handleRepoStateUpdate(data);
      break;

    case 'engineering_squad_commissioned':
      handleEngineeringSquadCommissioned(data);
      break;
  }
}

function handleStatusUpdate(data) {
  const banner = document.getElementById('status-banner');
  const message = document.getElementById('status-message');
  const meetingBadge = document.getElementById('meeting-status-text');

  if (['started', 'hiring', 'debating', 'arbitration', 'clarifying', 'escalating', 'pre_mortem', 'synthesizing', 'waiting_relaxation'].includes(data.status)) {
    if (banner) banner.style.display = 'flex';
    if (message) message.textContent = data.message;
    if (meetingBadge) meetingBadge.textContent = `⚡ ${data.message}`;
  } else if (data.status === 'completed') {
    if (banner) banner.style.display = 'none';
    if (meetingBadge) meetingBadge.textContent = '✅ Meeting Session Completed';
  }
}

let currentSwarmOrgMode = 'dynamic';

const agentMetaCatalog = {
  head_pmo: { avatar: '👨‍💼', title: 'Head of PMO', role: 'Executive Portfolio Lead & Orchestrator' },
  tech_pm: { avatar: '👨‍💻', title: 'Engineering PM', role: 'Technical Architecture & Concurrency' },
  ops_pm: { avatar: '👩‍💼', title: 'Ops & Finance PM', role: 'FinOps Limits & Governance' },
  cloud_architect: { avatar: '🏗️', title: 'Cloud Architect', role: 'Distributed Systems & Replication' },
  cost_auditor: { avatar: '💰', title: 'Cost Auditor', role: 'Budgets & OpEx Verification' },
  security_officer: { avatar: '🛡️', title: 'Security Lead', role: 'Zero-Trust & Idempotency' },
  qa_lead: { avatar: '🧪', title: 'QA & Reliability Lead', role: 'Throughput & Chaos Benchmarks' },
  devops_engineer: { avatar: '⚙️', title: 'DevOps Lead', role: 'SRE & Zero-Downtime Rollouts' },
  data_engineer: { avatar: '📊', title: 'Data Pipeline Lead', role: 'Event Queues & Deduplication' },
  database_specialist: { avatar: '🗄️', title: 'Database Specialist', role: 'Database Sharding & State Reconciliation' },
  performance_engineer: { avatar: '⚡', title: 'Performance Engineer', role: 'High-Throughput Concurrency & Latency SLAs' },
  compliance_auditor: { avatar: '📜', title: 'Compliance Auditor', role: 'Regulatory Compliance & Legal Telemetry' },
  risk_analyst: { avatar: '⚠️', title: 'Risk Analyst', role: 'Exposure & Trade-Off Analysis' },
  devils_advocate: { avatar: '⚖️', title: "Devil's Advocate", role: 'Adversarial Red Team Lead' },
  sdm_lead: { avatar: '👔', title: 'Software Development Manager', role: 'Sprint Architecture & Code Contracts' },
  swe_backend: { avatar: '👨‍💻', title: 'Senior Backend SWE', role: 'Core Logic, Concurrency & Idempotency' },
  swe_frontend: { avatar: '💻', title: 'Frontend & Client SWE', role: 'Client Interface & CLI Controller' },
  sdet_qa: { avatar: '🧪', title: 'SDET Automation Engineer', role: 'Automated Unit Tests & Self-Healing' },
  devops_sre: { avatar: '⚙️', title: 'DevOps & Release SRE', role: 'Containerization & Git Release' }
};

function getAgentMeta(id) {
  return agentMetaCatalog[id] || { avatar: '👤', title: id.replace(/_/g, ' ').toUpperCase(), role: 'Domain Specialist' };
}

function setSwarmOrgMode(mode) {
  currentSwarmOrgMode = mode;
  
  // Sync landing hero pills
  document.querySelectorAll('.org-mode-pill').forEach(p => p.classList.remove('active'));
  const heroTarget = document.getElementById(`btn-org-${mode}`);
  if (heroTarget) heroTarget.classList.add('active');

  // Sync sidebar mode badge
  const badge = document.getElementById('roster-mode-badge');
  if (badge) {
    if (mode === 'dynamic') {
      badge.textContent = '⚡ Autonomous Dynamic';
      badge.className = 'roster-mode-badge';
    } else {
      badge.textContent = '🏛️ Fixed PMO Swarm';
      badge.className = 'roster-mode-badge classic';
    }
  }

  // Sync sidebar containers
  const dynWrapper = document.getElementById('dynamic-roster-wrapper');
  const classicWrapper = document.getElementById('classic-roster-wrapper');
  if (mode === 'dynamic') {
    if (dynWrapper) dynWrapper.style.display = 'block';
    if (classicWrapper) classicWrapper.style.display = 'none';
    setupAutonomousOfficeView();
  } else {
    if (dynWrapper) dynWrapper.style.display = 'none';
    if (classicWrapper) classicWrapper.style.display = 'block';
    setupClassicOfficeView();
  }

  const autoBar = document.getElementById('autonomous-model-bar');
  if (autoBar) {
    autoBar.style.display = mode === 'dynamic' ? 'flex' : 'none';
  }
}

const allOfficeAgentIds = [
  'tech_pm', 'ops_pm', 'cloud_architect', 'cost_auditor', 
  'security_officer', 'qa_lead', 'devops_engineer', 'data_engineer', 
  'risk_analyst', 'devils_advocate'
];

const classic7AgentIds = [
  'tech_pm', 'ops_pm', 'cloud_architect', 'cost_auditor', 
  'security_officer', 'qa_lead', 'devils_advocate'
];

function setupAutonomousOfficeView() {
  // Use clean office floor with ONLY executive desk (no empty tables/chairs in the room)
  const canvasWrapper = document.getElementById('canvas-zoom-wrapper');
  if (canvasWrapper) {
    canvasWrapper.style.setProperty('background-image', "url('/static/stratum_office_exec_only.jpg?v=pristine_seamless_v14')", 'important');
  }

  // Reset dynamic sidebar roster: show placeholder awaiting Phase 0, clear chips
  const dynPlaceholder = document.getElementById('dynamic-roster-placeholder');
  if (dynPlaceholder) dynPlaceholder.style.display = 'block';
  const dynContainer = document.getElementById('dynamic-commissioned-container');
  if (dynContainer) dynContainer.style.display = 'none';
  const tier2Chips = document.getElementById('dyn-tier2-chips');
  if (tier2Chips) tier2Chips.innerHTML = '';
  const tier3Chips = document.getElementById('dyn-tier3-chips');
  if (tier3Chips) tier3Chips.innerHTML = '';
  const redChips = document.getElementById('dyn-redteam-chips');
  if (redChips) redChips.innerHTML = '';
  const dynTier2 = document.getElementById('dyn-tier2-section');
  if (dynTier2) dynTier2.style.display = 'none';
  const dynTier3 = document.getElementById('dyn-tier3-section');
  if (dynTier3) dynTier3.style.display = 'none';
  const dynRed = document.getElementById('dyn-redteam-section');
  if (dynRed) dynRed.style.display = 'none';

  // Executive Desk & Doll (Head of PMO): visible and seated
  const headDesk = document.getElementById('meeting-card-head_pmo');
  if (headDesk) {
    headDesk.style.display = 'flex';
    headDesk.classList.remove('unhired-desk', 'just-hired-desk', 'fired-warning');
    const pillTitle = headDesk.querySelector('.pill-title');
    if (pillTitle) pillTitle.textContent = 'Head of PMO (Executive)';
  }
  const headDoll = document.getElementById('doll-head_pmo');
  if (headDoll) {
    headDoll.style.display = 'block';
    headDoll.classList.add('seated');
    headDoll.classList.remove('fired');
  }

  // In dynamic mode, hide all other tables, chairs, and dolls until commissioned by Head of PMO!
  allOfficeAgentIds.forEach(id => {
    // Hide table overlay
    const tbl = document.getElementById(`table-${id}`);
    if (tbl) tbl.style.display = 'none';

    // Hide doll
    const doll = document.getElementById(`doll-${id}`);
    if (doll) {
      doll.style.display = 'none';
      doll.classList.remove('seated', 'fired');
    }

    // Hide hotspot desk card
    const card = document.getElementById(`meeting-card-${id}`);
    if (card) {
      card.style.display = 'none';
      card.classList.add('unhired-desk');
      card.classList.remove('just-hired-desk', 'speaking', 'thinking-active', 'fired-warning');
    }

    const banner = document.getElementById(`hired-${id}`);
    if (banner) banner.style.display = 'none';
  });

  const statusText = document.getElementById('meeting-status-text');
  if (statusText) {
    statusText.innerHTML = '<span class="status-pulse-dot"></span> 🏢 Corporate War Room · Ready for Commissioning (Head of PMO)';
  }
}

function setupClassicOfficeView() {
  const canvasWrapper = document.getElementById('canvas-zoom-wrapper');
  if (canvasWrapper) {
    canvasWrapper.style.setProperty('background-image', "url('/static/stratum_office_exec_only.jpg?v=pristine_seamless_v14')", 'important');
  }

  // Executive Desk & Doll
  const headDesk = document.getElementById('meeting-card-head_pmo');
  if (headDesk) {
    headDesk.style.display = 'flex';
    headDesk.classList.remove('unhired-desk', 'just-hired-desk');
    const pillTitle = headDesk.querySelector('.pill-title');
    if (pillTitle) pillTitle.textContent = 'Head of PMO';
  }
  const headDoll = document.getElementById('doll-head_pmo');
  if (headDoll) {
    headDoll.style.display = 'block';
    headDoll.classList.add('seated');
    headDoll.classList.remove('fired');
  }

  // In classic mode, show standard 7 benchmark agents & their tables
  classic7AgentIds.forEach(id => {
    const tbl = document.getElementById(`table-${id}`);
    if (tbl) tbl.style.display = 'block';

    const card = document.getElementById(`meeting-card-${id}`);
    if (card) {
      card.style.display = 'flex';
      card.classList.remove('unhired-desk', 'just-hired-desk');
    }
    const doll = document.getElementById(`doll-${id}`);
    if (doll) {
      doll.style.display = 'block';
      doll.classList.add('seated');
      doll.classList.remove('fired');
    }
  });

  // Hide the 3 extra specialists in fixed 7-agent mode
  ['devops_engineer', 'data_engineer', 'risk_analyst'].forEach(id => {
    const tbl = document.getElementById(`table-${id}`);
    if (tbl) tbl.style.display = 'none';
    const card = document.getElementById(`meeting-card-${id}`);
    if (card) card.style.display = 'none';
    const doll = document.getElementById(`doll-${id}`);
    if (doll) doll.style.display = 'none';
  });

  activeCommissionedHierarchy = {
    agents: ['head_pmo', 'tech_pm', 'ops_pm', 'cloud_architect', 'cost_auditor', 'security_officer', 'qa_lead', 'devils_advocate'],
    managers: ['tech_pm', 'ops_pm'],
    specialists: ['cloud_architect', 'cost_auditor', 'security_officer', 'qa_lead'],
    red_team: ['devils_advocate']
  };
  drawHierarchyReportingLines();

  const statusText = document.getElementById('meeting-status-text');
  if (statusText) {
    statusText.innerHTML = '<span class="status-pulse-dot"></span> 👥 7 Standard Benchmark PMO Agents Active in Office';
  }
}

function updateActiveOfficeAgentCount() {
  const statusText = document.getElementById('meeting-status-text');
  if (!statusText) return;

  const visibleDesks = Array.from(document.querySelectorAll('.desk-hotspot')).filter(d => d.style.display !== 'none' && !d.classList.contains('unhired-desk'));
  const activeCount = Math.max(1, visibleDesks.length);

  statusText.innerHTML = `<span class="status-pulse-dot"></span> 👥 ${activeCount} AI Agents Active in Office`;
}

function handleEscalationFiled(data) {
  const banner = document.getElementById('arbitration-banner');
  const title = document.getElementById('arbitration-title');
  const detail = document.getElementById('arbitration-detail');
  if (banner && title && detail) {
    title.textContent = `⚖️ Formal Grievance: ${data.accuser} escalated ${data.accused}`;
    detail.textContent = data.allegation;
    banner.style.display = 'flex';
  }
  showToastNotification(`🚨 PEER ESCALATION: ${data.accuser} escalated ${data.accused}!`, 'warning');

  // Visually draw escalation trajectory to manager and accused
  const mgrId = data.manager_id || (data.allegation && (data.allegation.toLowerCase().includes('budget') || data.allegation.toLowerCase().includes('cost')) ? 'ops_pm' : 'tech_pm');
  drawEscalationLine(data.accuser, data.accused, mgrId, data.allegation);
}

function dismissArbitrationBanner() {
  const banner = document.getElementById('arbitration-banner');
  if (banner) banner.style.display = 'none';
}

function handleAgentFired(data) {
  showToastNotification(`⚠️ AGENT FIRED: ${data.title} was terminated! Reason: ${data.reason}`, 'error');
  const card = document.getElementById(`meeting-card-${data.agent_id}`);
  if (card) {
    card.classList.add('fired-warning');
    const titleElem = card.querySelector('.pill-title');
    if (titleElem) titleElem.textContent = `⚠️ ${data.title} (Dismissed)`;
  }
  const doll = document.getElementById(`doll-${data.agent_id}`);
  if (doll) {
    doll.classList.remove('seated');
    doll.classList.add('fired');
  }
  const chip = document.getElementById(`chip-${data.agent_id}`);
  if (chip) {
    chip.classList.add('fired-chip');
  }

  // Draw termination ruling line
  const mgrId = data.manager_id || (data.reason && (data.reason.toLowerCase().includes('budget') || data.reason.toLowerCase().includes('cost')) ? 'ops_pm' : 'tech_pm');
  drawVerdictRulingLine(mgrId, data.agent_id, data.reason, true);
}

function handleArbitrationVerdict(data) {
  const mgrId = data.manager_id || 'ops_pm';
  const accusedId = data.accused_id;
  drawVerdictRulingLine(mgrId, accusedId, data.verdict, data.is_terminated);
  showToastNotification(
    data.is_terminated 
      ? `⚖️ Manager Ruling: Agent fired & replacement commissioned.` 
      : `⚖️ Manager Ruling: Binding compromise enforced!`,
    data.is_terminated ? 'error' : 'info'
  );
}

function handleAgentHired(data) {
  const agentId = data.agent_id;
  const isInitial = data.is_initial_hire !== false;
  const meta = getAgentMeta(agentId);
  const title = data.title || meta.title;
  const avatar = data.avatar || meta.avatar;

  if (isInitial) {
    showToastNotification(`✨ COMMISSIONED: ${title} (${data.reason || 'Specialist'})`, 'success');
  } else {
    showToastNotification(`✅ AGENT RE-HIRED: ${title} commissioned with Knowledge Transfer brief!`, 'success');
  }

  // 1. Reveal Workstation Table dynamically!
  const tbl = document.getElementById(`table-${agentId}`);
  if (tbl) {
    tbl.style.display = 'block';
    tbl.style.opacity = '0';
    tbl.style.transform = 'translateY(12px)';
    setTimeout(() => {
      tbl.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
      tbl.style.opacity = '1';
      tbl.style.transform = 'translateY(0)';
    }, 50);
  }

  // 2. Reveal and seat the doll figure in the chair!
  const doll = document.getElementById(`doll-${agentId}`);
  if (doll) {
    doll.style.display = 'block';
    doll.classList.remove('fired');
    doll.classList.add('seated');
  }

  // 3. Reveal or dynamically create the workstation desk hotspot card!
  let card = document.getElementById(`meeting-card-${agentId}`);
  if (!card) {
    const wrapper = document.getElementById('canvas-zoom-wrapper');
    if (wrapper) {
      card = document.createElement('div');
      card.id = `meeting-card-${agentId}`;
      card.className = `desk-hotspot placement-side-left tier3-hotspot dynamic-desk-hotspot`;
      card.setAttribute('data-agent', agentId);
      
      const dynIndex = document.querySelectorAll('.dynamic-desk-hotspot').length;
      const leftPositions = [18, 32, 68, 82, 22, 78];
      const topPositions = [52, 53, 53, 52, 38, 38];
      const posIdx = dynIndex % leftPositions.length;
      card.style.left = `${leftPositions[posIdx]}%`;
      card.style.top = `${topPositions[posIdx]}%`;
      
      card.innerHTML = `
        <div class="metaphor-workstation 3d-doll-workstation">
          <div class="workstation-3d-wrapper">
            <div class="doll-domain-badge doll-tech">${avatar}</div>
            <img src="${getAgentWorkstationImage(agentId)}?v=manager_pods_v18" class="doll-3d-workstation-img" alt="${title} Wooden Doll">
          </div>
        </div>
        <div class="floating-agent-pill tier3-pill">
          <span class="pill-avatar">${avatar}</span>
          <span class="pill-title">${title}</span>
          <span class="active-dot">● Active</span>
        </div>
        <div class="thinking-cloud" id="think-${agentId}" style="display: none;">
          <span class="think-pulse">💭</span>
          <span class="think-text">Analyzing Domain...</span>
        </div>
        <div class="speech-bubble-popup placement-side-left" id="bubble-${agentId}" style="display: none;">
          <div class="bubble-header">
            <span class="agent-title-tag">${avatar} ${title}</span>
            <span class="phase-tag" id="phase-${agentId}">Phase 3</span>
          </div>
          <div class="bubble-body custom-scrollbar" id="text-${agentId}"></div>
        </div>
      `;
      wrapper.appendChild(card);
    }
  }

  if (card) {
    card.style.display = 'flex';
    card.classList.remove('unhired-desk', 'fired-warning');
    card.classList.add('just-hired-desk');
    setTimeout(() => {
      card.classList.remove('just-hired-desk');
    }, 2800);

    const titleElem = card.querySelector('.pill-title');
    if (titleElem) titleElem.textContent = title;

    let hiredBanner = document.getElementById(`hired-${agentId}`);
    if (!hiredBanner) {
      hiredBanner = document.createElement('div');
      hiredBanner.id = `hired-${agentId}`;
      hiredBanner.className = agentId === 'devils_advocate' ? 'hired-banner red-hired' : 'hired-banner';
      card.appendChild(hiredBanner);
    }
    hiredBanner.innerHTML = `✨ COMMISSIONED<br><small style="font-size: 9px; font-weight: normal; opacity: 0.9;">${data.reason ? data.reason.slice(0, 36) + '...' : ''}</small>`;
    hiredBanner.style.display = 'block';
    setTimeout(() => {
      if (hiredBanner) hiredBanner.style.display = 'none';
    }, 4500);
  }

  // 4. In Dynamic Mode, create and append agent card into sidebar under corporate hierarchy!
  if (currentSwarmOrgMode === 'dynamic') {
    const dynPlaceholder = document.getElementById('dynamic-roster-placeholder');
    if (dynPlaceholder) dynPlaceholder.style.display = 'none';

    const dynContainer = document.getElementById('dynamic-commissioned-container');
    if (dynContainer) dynContainer.style.display = 'block';

    let targetSectionId = 'dyn-tier3-section';
    let targetChipsId = 'dyn-tier3-chips';
    if (data.is_engineering_squad || ['sdm_lead', 'swe_backend', 'swe_frontend', 'sdet_qa', 'devops_sre'].includes(agentId)) {
      targetSectionId = 'dyn-eng-squad-section';
      targetChipsId = 'dyn-eng-squad-chips';
    } else if (data.tier === 'tier2' || agentId === 'tech_pm' || agentId === 'ops_pm') {
      targetSectionId = 'dyn-tier2-section';
      targetChipsId = 'dyn-tier2-chips';
    } else if (agentId === 'devils_advocate') {
      targetSectionId = 'dyn-redteam-section';
      targetChipsId = 'dyn-redteam-chips';
    }

    const sec = document.getElementById(targetSectionId);
    if (sec) sec.style.display = 'block';

    const chipsContainer = document.getElementById(targetChipsId);
    let existingChip = document.getElementById(`chip-${agentId}`);
    if (!existingChip && chipsContainer) {
      const chip = document.createElement('div');
      chip.className = `agent-chip-item just-hired-chip ${agentId === 'devils_advocate' ? 'red-team-chip' : ''}`;
      chip.id = `chip-${agentId}`;

      const managerTitle = data.manager_id ? (getAgentMeta(data.manager_id).title || data.manager_id) : 'Head of PMO';
      const reportingStr = data.manager_id && data.manager_id !== 'head_pmo' 
        ? `Reports to: ${managerTitle}` 
        : 'Executive Direct Report';

      chip.innerHTML = `
        <span class="agent-avatar">${avatar}</span>
        <div class="agent-meta">
          <span class="agent-name">${title}</span>
          <span class="agent-role" title="${data.reason || meta.role}">${reportingStr}</span>
        </div>
        <span class="agent-indicator idle"></span>
      `;
      chipsContainer.appendChild(chip);
      setTimeout(() => chip.classList.remove('just-hired-chip'), 2500);
    }
  } else {
    const chip = document.getElementById(`classic-chip-${agentId}`) || document.getElementById(`chip-${agentId}`);
    if (chip) {
      chip.classList.remove('unhired-chip', 'fired-chip');
      chip.classList.add('just-hired-chip');
      setTimeout(() => chip.classList.remove('just-hired-chip'), 2500);
    }
  }

  updateActiveOfficeAgentCount();
}

let isHierarchyLinesEnabled = true;
let activeCommissionedHierarchy = null;

function toggleHierarchyLines() {
  isHierarchyLinesEnabled = !isHierarchyLinesEnabled;
  const btn = document.getElementById('btn-toggle-hierarchy-lines');
  if (btn) {
    if (isHierarchyLinesEnabled) {
      btn.classList.add('active');
      btn.innerHTML = '<span class="material-icons-outlined">account_tree</span><span>Reporting Lines 🌐</span>';
      showToastNotification('🌐 Organizational Reporting Lines Enabled', 'info');
    } else {
      btn.classList.remove('active');
      btn.innerHTML = '<span class="material-icons-outlined">account_tree</span><span>Reporting Lines (Hidden)</span>';
      showToastNotification('Reporting Lines Hidden', 'info');
    }
  }
  drawHierarchyReportingLines();
}

function getAgentDeskCenter(id, vRect) {
  const card = document.getElementById(`meeting-card-${id}`);
  if (!card || card.style.display === 'none') return null;

  const viewport = document.getElementById('canvas-zoom-wrapper');
  const vpWidth = viewport ? viewport.clientWidth : (vRect ? vRect.width : 1000);
  const vpHeight = viewport ? viewport.clientHeight : (vRect ? vRect.height : 600);

  // Directly calculate local SVG coordinates from hotspot percentage style
  let leftPct = parseFloat(card.style.left);
  let topPct = parseFloat(card.style.top);

  if (isNaN(leftPct) || isNaN(topPct)) {
    const pill = card.querySelector('.floating-agent-pill') || card;
    const pr = pill.getBoundingClientRect();
    const vr = vRect || (viewport ? viewport.getBoundingClientRect() : { left: 0, top: 0, width: vpWidth, height: vpHeight });
    return {
      x: ((pr.left + pr.width / 2 - vr.left) / (vr.width || 1)) * vpWidth,
      y: ((pr.top + pr.height / 2 - vr.top) / (vr.height || 1)) * vpHeight
    };
  }

  return {
    x: (leftPct / 100) * vpWidth,
    y: (topPct / 100) * vpHeight
  };
}

function drawHierarchyReportingLines() {
  const svgHierarchy = document.getElementById('svg-hierarchy-lines');
  const viewport = document.getElementById('canvas-zoom-wrapper');
  if (!svgHierarchy || !viewport) return;
  svgHierarchy.innerHTML = '';

  if (!isHierarchyLinesEnabled) return;

  // Auto-detect active hierarchy if not explicitly set yet
  if (!activeCommissionedHierarchy) {
    const visibleCards = Array.from(document.querySelectorAll('.desk-hotspot')).filter(c => c.style.display !== 'none');
    const visibleIds = visibleCards.map(c => c.getAttribute('data-agent')).filter(Boolean);
    if (visibleIds.length > 1) {
      activeCommissionedHierarchy = {
        agents: visibleIds,
        managers: visibleIds.filter(id => id.includes('pm') || id === 'sdm_lead'),
        specialists: visibleIds.filter(id => !id.includes('pm') && id !== 'head_pmo' && id !== 'devils_advocate' && id !== 'sdm_lead'),
        red_team: visibleIds.includes('devils_advocate') ? ['devils_advocate'] : []
      };
    }
  }

  if (!activeCommissionedHierarchy) return;

  const vRect = viewport.getBoundingClientRect();

  const headPos = getAgentDeskCenter('head_pmo', vRect);
  const techPmPos = getAgentDeskCenter('tech_pm', vRect);
  const opsPmPos = getAgentDeskCenter('ops_pm', vRect);
  const sdmPos = getAgentDeskCenter('sdm_lead', vRect);
  const redTeamPos = getAgentDeskCenter('devils_advocate', vRect);

  const drawHierarchyCurve = (p1, p2, color, className) => {
    if (!p1 || !p2) return;
    const cx = (p1.x + p2.x) / 2;
    const cy = Math.min(p1.y, p2.y) + Math.abs(p1.y - p2.y) * 0.35;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`);
    path.setAttribute('class', className);
    svgHierarchy.appendChild(path);

    // Glowing anchor marker on subordinate desk
    const dot1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot1.setAttribute('cx', p1.x);
    dot1.setAttribute('cy', p1.y);
    dot1.setAttribute('r', '4');
    dot1.setAttribute('fill', color);
    dot1.setAttribute('filter', 'url(#line-glow)');
    svgHierarchy.appendChild(dot1);

    // Glowing anchor marker on manager desk
    const dot2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot2.setAttribute('cx', p2.x);
    dot2.setAttribute('cy', p2.y);
    dot2.setAttribute('r', '4');
    dot2.setAttribute('fill', color);
    dot2.setAttribute('filter', 'url(#line-glow)');
    svgHierarchy.appendChild(dot2);
  };

  // 1. Executive Reporting Lines (Managers -> Head of PMO)
  if (techPmPos && headPos) {
    drawHierarchyCurve(techPmPos, headPos, '#a855f7', 'hierarchy-path-exec');
  }
  if (opsPmPos && headPos) {
    drawHierarchyCurve(opsPmPos, headPos, '#a855f7', 'hierarchy-path-exec');
  }
  if (sdmPos && headPos) {
    drawHierarchyCurve(sdmPos, headPos, '#a855f7', 'hierarchy-path-exec');
  }
  if (redTeamPos && headPos) {
    drawHierarchyCurve(redTeamPos, headPos, '#f43f5e', 'hierarchy-path-red');
  }

  // 2. Specialists and Engineering Squad -> Managers
  const specialists = activeCommissionedHierarchy.specialists || [];
  specialists.forEach(sid => {
    const specPos = getAgentDeskCenter(sid, vRect);
    if (!specPos) return;

    // Phase 7 SDM Engineering Squad -> SDM Lead (or Tech PM / Head PMO fallback)
    const isEngSquad = ['swe_backend', 'swe_frontend', 'sdet_qa', 'devops_sre'].includes(sid);
    if (isEngSquad) {
      const targetMgrPos = sdmPos || techPmPos || headPos;
      if (targetMgrPos) {
        drawHierarchyCurve(specPos, targetMgrPos, '#10b981', 'hierarchy-path-tech');
      }
      return;
    }

    const isTech = ['cloud_architect', 'devops_engineer', 'data_engineer', 'database_specialist', 'qa_lead', 'performance_engineer', 'swe_backend', 'swe_frontend'].includes(sid) ||
      sid.includes('cloud') || sid.includes('data') || sid.includes('devops') || sid.includes('qa') || sid.includes('db') || sid.includes('perf') || sid.includes('eng') || sid.includes('arch');

    if (isTech) {
      const targetMgrPos = techPmPos || headPos;
      if (targetMgrPos) {
        drawHierarchyCurve(specPos, targetMgrPos, '#38bdf8', 'hierarchy-path-tech');
      }
    } else {
      const targetMgrPos = opsPmPos || headPos;
      if (targetMgrPos) {
        drawHierarchyCurve(specPos, targetMgrPos, '#fbbf24', 'hierarchy-path-ops');
      }
    }
  });
}

let escalationCleanupTimer = null;

function clearEscalationAndRulingLines(immediate = false) {
  if (escalationCleanupTimer) {
    clearTimeout(escalationCleanupTimer);
    escalationCleanupTimer = null;
  }
  const svgEscalation = document.getElementById('svg-escalation-lines');
  const clearHotspots = () => {
    document.querySelectorAll('.desk-hotspot').forEach(c => {
      c.classList.remove('escalation-accuser-active', 'escalation-accused-active');
    });
  };

  if (!svgEscalation) {
    clearHotspots();
    return;
  }

  if (immediate) {
    svgEscalation.innerHTML = '';
    svgEscalation.style.opacity = '1';
    clearHotspots();
    return;
  }

  // Smooth fade out so screen stays clean
  svgEscalation.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
  svgEscalation.style.opacity = '0';
  setTimeout(() => {
    svgEscalation.innerHTML = '';
    svgEscalation.style.opacity = '1';
    svgEscalation.style.transition = '';
    clearHotspots();
  }, 800);
}

function drawEscalationLine(accuserId, accusedId, managerId, allegation) {
  const svgEscalation = document.getElementById('svg-escalation-lines');
  const viewport = document.getElementById('canvas-zoom-wrapper');
  if (!svgEscalation || !viewport) return;

  if (escalationCleanupTimer) {
    clearTimeout(escalationCleanupTimer);
    escalationCleanupTimer = null;
  }
  svgEscalation.innerHTML = '';
  svgEscalation.style.opacity = '1';
  svgEscalation.style.transition = '';

  const vRect = viewport.getBoundingClientRect();
  const accuserPos = getAgentDeskCenter(accuserId, vRect);
  const accusedPos = getAgentDeskCenter(accusedId, vRect);
  const mgrPos = getAgentDeskCenter(managerId || 'ops_pm', vRect);

  if (accuserPos && accusedPos) {
    const cx1 = (accuserPos.x + accusedPos.x) / 2;
    const cy1 = Math.min(accuserPos.y, accusedPos.y) - 45;
    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', `M ${accuserPos.x} ${accuserPos.y} Q ${cx1} ${cy1} ${accusedPos.x} ${accusedPos.y}`);
    path1.setAttribute('class', 'animated-escalation-line');
    path1.setAttribute('marker-end', 'url(#escalation-arrow)');
    svgEscalation.appendChild(path1);

    const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreign.setAttribute('x', cx1 - 90);
    foreign.setAttribute('y', cy1 - 18);
    foreign.setAttribute('width', 180);
    foreign.setAttribute('height', 36);
    foreign.innerHTML = `<div class="svg-escalation-pill">⚡ ESCALATED: ${allegation ? allegation.slice(0, 22) + '...' : 'Grievance'}</div>`;
    svgEscalation.appendChild(foreign);
  }

  if (accuserPos && mgrPos) {
    const cx2 = (accuserPos.x + mgrPos.x) / 2;
    const cy2 = Math.min(accuserPos.y, mgrPos.y) - 35;
    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', `M ${accuserPos.x} ${accuserPos.y} Q ${cx2} ${cy2} ${mgrPos.x} ${mgrPos.y}`);
    path2.setAttribute('class', 'animated-manager-appeal-line');
    path2.setAttribute('marker-end', 'url(#manager-arrow)');
    svgEscalation.appendChild(path2);
  }

  document.querySelectorAll('.desk-hotspot').forEach(c => c.classList.remove('escalation-accuser-active', 'escalation-accused-active'));
  const accuserCard = document.getElementById(`meeting-card-${accuserId}`);
  if (accuserCard) accuserCard.classList.add('escalation-accuser-active');
  const accusedCard = document.getElementById(`meeting-card-${accusedId}`);
  if (accusedCard) accusedCard.classList.add('escalation-accused-active');

  // Auto clean-up after 18s fallback if no verdict arrives
  escalationCleanupTimer = setTimeout(() => {
    clearEscalationAndRulingLines(false);
  }, 18000);
}

function drawVerdictRulingLine(managerId, accusedId, verdictText, isTerminated) {
  const svgEscalation = document.getElementById('svg-escalation-lines');
  const viewport = document.getElementById('canvas-zoom-wrapper');
  if (!svgEscalation || !viewport) return;

  if (escalationCleanupTimer) {
    clearTimeout(escalationCleanupTimer);
    escalationCleanupTimer = null;
  }
  // Clear prior confrontation lines immediately so only the authoritative decision displays!
  svgEscalation.innerHTML = '';
  svgEscalation.style.opacity = '1';
  svgEscalation.style.transition = '';

  const vRect = viewport.getBoundingClientRect();
  const mgrPos = getAgentDeskCenter(managerId || 'ops_pm', vRect);
  const accusedPos = getAgentDeskCenter(accusedId, vRect);

  if (mgrPos && accusedPos) {
    const strokeColor = isTerminated ? '#ef4444' : '#10b981';
    const cx = (mgrPos.x + accusedPos.x) / 2;
    const cy = Math.min(mgrPos.y, accusedPos.y) - 30;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${mgrPos.x} ${mgrPos.y} Q ${cx} ${cy} ${accusedPos.x} ${accusedPos.y}`);
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('class', 'animated-verdict-line');
    path.setAttribute('marker-end', 'url(#ruling-arrow)');
    svgEscalation.appendChild(path);

    const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreign.setAttribute('x', cx - 110);
    foreign.setAttribute('y', cy - 18);
    foreign.setAttribute('width', 220);
    foreign.setAttribute('height', 38);
    foreign.innerHTML = `<div class="svg-verdict-pill ${isTerminated ? 'fired-pill' : 'compromise-pill'}">${isTerminated ? '⚠️ TERMINATED & REHIRED' : '⚖️ BINDING COMPROMISE ENFORCED'}</div>`;
    svgEscalation.appendChild(foreign);
  }

  // Clear confrontation highlight on accuser
  document.querySelectorAll('.desk-hotspot').forEach(c => c.classList.remove('escalation-accuser-active'));

  // Highlight accused desk with verdict status
  const accusedCard = document.getElementById(`meeting-card-${accusedId}`);
  if (accusedCard) {
    accusedCard.classList.remove('escalation-accused-active');
    accusedCard.classList.add(isTerminated ? 'fired-warning' : 'targeted-active');
  }

  // Keep the ruling decision visible for 6 seconds so user clearly sees what happened, then smoothly fade out & remove!
  escalationCleanupTimer = setTimeout(() => {
    clearEscalationAndRulingLines(false);
  }, 6000);
}

function getAgentWorkstationImage(agentId) {
  const map = {
    'head_pmo': '/static/dolls/layer_head_pmo.png',
    'tech_pm': '/static/dolls/workstation_tech_pm.png',
    'ops_pm': '/static/dolls/workstation_ops_pm.png',
    'cloud_architect': '/static/dolls/workstation_cloud_architect.png',
    'cost_auditor': '/static/dolls/workstation_cost_auditor.png',
    'security_officer': '/static/dolls/workstation_security_officer.png',
    'qa_lead': '/static/dolls/workstation_qa_lead.png',
    'devils_advocate': '/static/dolls/workstation_devils_advocate.png',
    'devops_engineer': '/static/dolls/workstation_tech_pm.png',
    'data_engineer': '/static/dolls/workstation_cloud_architect.png',
    'database_specialist': '/static/dolls/workstation_cloud_architect.png',
    'performance_engineer': '/static/dolls/workstation_qa_lead.png',
    'risk_analyst': '/static/dolls/workstation_cost_auditor.png',
    'compliance_auditor': '/static/dolls/workstation_security_officer.png'
  };
  if (map[agentId]) return map[agentId];
  if (agentId.includes('cloud') || agentId.includes('data') || agentId.includes('devops') || agentId.includes('db') || agentId.includes('perf') || agentId.includes('eng')) {
    return '/static/dolls/workstation_cloud_architect.png';
  }
  return '/static/dolls/workstation_cost_auditor.png';
}

function layoutManagerLedOffice(data) {
  const wrapper = document.getElementById('canvas-zoom-wrapper');
  if (!wrapper) return;

  const commissionedAgents = data.agents || [];
  const specialists = data.specialists || [];
  activeCommissionedHierarchy = data;

  // 0. Hide all existing cards, dolls, and tables not commissioned in this initiative!
  document.querySelectorAll('.desk-hotspot').forEach(card => {
    const aid = card.getAttribute('data-agent');
    if (aid && !commissionedAgents.includes(aid)) {
      card.style.display = 'none';
      card.classList.add('unhired-desk');
    }
  });
  document.querySelectorAll('.doll-layer').forEach(doll => {
    const aid = doll.id.replace('doll-', '');
    if (aid && aid !== 'head_pmo' && !commissionedAgents.includes(aid)) {
      doll.style.display = 'none';
      doll.classList.remove('seated');
    }
  });
  document.querySelectorAll('.table-layer').forEach(tbl => {
    const aid = tbl.id.replace('table-', '');
    if (aid && !commissionedAgents.includes(aid)) {
      tbl.style.display = 'none';
    }
  });

  // 1. Dynamic scale factor based on team size
  const totalCount = commissionedAgents.length;
  wrapper.classList.remove('team-compact', 'team-dense');
  if (totalCount >= 14) {
    wrapper.classList.add('team-dense');
  } else if (totalCount >= 9) {
    wrapper.classList.add('team-compact');
  }

  // 2. Separate specialists by reporting stream
  const techSpecs = [];
  const opsSpecs = [];

  specialists.forEach(sid => {
    const isTech = ['cloud_architect', 'devops_engineer', 'data_engineer', 'database_specialist', 'qa_lead', 'performance_engineer', 'swe_backend', 'swe_frontend'].includes(sid) ||
      sid.includes('cloud') || sid.includes('data') || sid.includes('devops') || sid.includes('qa') || sid.includes('db') || sid.includes('perf') || sid.includes('eng') || sid.includes('arch') || sid.includes('swe');
    if (isTech) {
      techSpecs.push(sid);
    } else {
      opsSpecs.push(sid);
    }
  });

  // 3. Map positions
  const posMap = {};

  // Top Center: Head of PMO (Executive Suite)
  posMap['head_pmo'] = { left: 50, top: 22, dept: 'exec', role: 'Executive Portfolio Lead', mgr: null };

  // Left Floor: Red Team Auditor (Firmly on carpet floor, well clear of window pane)
  if (commissionedAgents.includes('devils_advocate')) {
    posMap['devils_advocate'] = { left: 12, top: 60, dept: 'red', role: 'Red Team Adversarial Lead', mgr: 'head_pmo' };
  }

  // Manager Row (top: 38% - 40%)
  const hasSdm = commissionedAgents.includes('sdm_lead');
  if (hasSdm) {
    if (commissionedAgents.includes('tech_pm')) {
      posMap['tech_pm'] = { left: 26, top: 38, dept: 'tech', role: 'Engineering Program Manager', mgr: 'head_pmo' };
    }
    posMap['sdm_lead'] = { left: 50, top: 38, dept: 'tech', role: 'Software Development Manager', mgr: 'head_pmo' };
    if (commissionedAgents.includes('ops_pm')) {
      posMap['ops_pm'] = { left: 74, top: 38, dept: 'ops', role: 'Ops & Finance Program Manager', mgr: 'head_pmo' };
    }
  } else {
    if (commissionedAgents.includes('tech_pm')) {
      posMap['tech_pm'] = { left: 31, top: 40, dept: 'tech', role: 'Engineering Program Manager', mgr: 'head_pmo' };
    }
    if (commissionedAgents.includes('ops_pm')) {
      posMap['ops_pm'] = { left: 69, top: 40, dept: 'ops', role: 'Ops & Finance Program Manager', mgr: 'head_pmo' };
    }
  }

  // Calculate Tech Pod Specialists & Engineers (Left Pod: left 15% to 46%)
  const nt = techSpecs.length;
  if (nt > 0) {
    if (nt <= 3) {
      for (let i = 0; i < nt; i++) {
        const sid = techSpecs[i];
        let leftPct = nt === 1 ? 31 : (nt === 2 ? 22 + i * 18 : 16 + i * 14);
        const mgr = ['swe_backend', 'swe_frontend'].includes(sid) ? 'sdm_lead' : 'tech_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 64, dept: 'tech', mgr };
      }
    } else if (nt <= 6) {
      const row1Count = Math.ceil(nt / 2);
      const row2Count = nt - row1Count;
      // Row 1 (Mid Tech: top 56%)
      for (let i = 0; i < row1Count; i++) {
        const sid = techSpecs[i];
        let leftPct = row1Count === 2 ? 22 + i * 18 : 16 + i * 14;
        const mgr = ['swe_backend', 'swe_frontend'].includes(sid) ? 'sdm_lead' : 'tech_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 56, dept: 'tech', mgr };
      }
      // Row 2 (Front Tech: top 74%)
      for (let j = 0; j < row2Count; j++) {
        const sid = techSpecs[row1Count + j];
        let leftPct = row2Count === 2 ? 22 + j * 18 : 16 + j * 14;
        const mgr = ['swe_backend', 'swe_frontend'].includes(sid) ? 'sdm_lead' : 'tech_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 74, dept: 'tech', mgr };
      }
    } else {
      // 3 rows for high density
      const r1 = Math.ceil(nt / 3);
      const r2 = Math.ceil((nt - r1) / 2);
      const r3 = nt - r1 - r2;
      for (let i = 0; i < r1; i++) {
        const sid = techSpecs[i];
        let leftPct = r1 === 2 ? 22 + i * 18 : 15 + i * 14;
        const mgr = ['swe_backend', 'swe_frontend'].includes(sid) ? 'sdm_lead' : 'tech_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 54, dept: 'tech', mgr };
      }
      for (let j = 0; j < r2; j++) {
        const sid = techSpecs[r1 + j];
        let leftPct = r2 === 2 ? 22 + j * 18 : 15 + j * 14;
        const mgr = ['swe_backend', 'swe_frontend'].includes(sid) ? 'sdm_lead' : 'tech_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 67, dept: 'tech', mgr };
      }
      for (let k = 0; k < r3; k++) {
        const sid = techSpecs[r1 + r2 + k];
        let leftPct = r3 === 2 ? 22 + k * 18 : 15 + k * 14;
        const mgr = ['swe_backend', 'swe_frontend'].includes(sid) ? 'sdm_lead' : 'tech_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 80, dept: 'tech', mgr };
      }
    }
  }

  // Calculate Ops & Governance Pod Specialists (Right Pod: left 54% to 85%)
  const no = opsSpecs.length;
  if (no > 0) {
    if (no <= 3) {
      for (let i = 0; i < no; i++) {
        const sid = opsSpecs[i];
        let leftPct = no === 1 ? 69 : (no === 2 ? 60 + i * 18 : 55 + i * 14);
        const mgr = ['sdet_qa', 'devops_sre'].includes(sid) ? 'sdm_lead' : 'ops_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 64, dept: 'ops', mgr };
      }
    } else if (no <= 6) {
      const row1Count = Math.ceil(no / 2);
      const row2Count = no - row1Count;
      // Row 1 (Mid Ops: top 56%)
      for (let i = 0; i < row1Count; i++) {
        const sid = opsSpecs[i];
        let leftPct = row1Count === 2 ? 60 + i * 18 : 55 + i * 14;
        const mgr = ['sdet_qa', 'devops_sre'].includes(sid) ? 'sdm_lead' : 'ops_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 56, dept: 'ops', mgr };
      }
      // Row 2 (Front Ops: top 74%)
      for (let j = 0; j < row2Count; j++) {
        const sid = opsSpecs[row1Count + j];
        let leftPct = row2Count === 2 ? 60 + j * 18 : 55 + j * 14;
        const mgr = ['sdet_qa', 'devops_sre'].includes(sid) ? 'sdm_lead' : 'ops_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 74, dept: 'ops', mgr };
      }
    } else {
      // 3 rows for high density
      const r1 = Math.ceil(no / 3);
      const r2 = Math.ceil((no - r1) / 2);
      const r3 = no - r1 - r2;
      for (let i = 0; i < r1; i++) {
        const sid = opsSpecs[i];
        let leftPct = r1 === 2 ? 60 + i * 18 : 55 + i * 14;
        const mgr = ['sdet_qa', 'devops_sre'].includes(sid) ? 'sdm_lead' : 'ops_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 54, dept: 'ops', mgr };
      }
      for (let j = 0; j < r2; j++) {
        const sid = opsSpecs[r1 + j];
        let leftPct = r2 === 2 ? 60 + j * 18 : 55 + j * 14;
        const mgr = ['sdet_qa', 'devops_sre'].includes(sid) ? 'sdm_lead' : 'ops_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 67, dept: 'ops', mgr };
      }
      for (let k = 0; k < r3; k++) {
        const sid = opsSpecs[r1 + r2 + k];
        let leftPct = r3 === 2 ? 60 + k * 18 : 55 + k * 14;
        const mgr = ['sdet_qa', 'devops_sre'].includes(sid) ? 'sdm_lead' : 'ops_pm';
        posMap[sid] = { left: Math.round(leftPct), top: 80, dept: 'ops', mgr };
      }
    }
  }

  // 4. Position and render all desk cards & metaphor doll workstations!
  commissionedAgents.forEach(aid => {
    const p = posMap[aid] || { left: 50, top: 50, dept: 'tech', mgr: 'tech_pm' };
    let card = document.getElementById(`meeting-card-${aid}`);
    const meta = getAgentMeta(aid);
    const avatar = meta.avatar || '👤';
    const title = meta.title || aid.replace(/_/g, ' ').toUpperCase();

    if (!card) {
      card = document.createElement('div');
      card.id = `meeting-card-${aid}`;
      card.className = `desk-hotspot placement-side-left tier3-hotspot dynamic-desk-hotspot`;
      card.setAttribute('data-agent', aid);
      wrapper.appendChild(card);
    }

    // Set position
    card.style.left = `${p.left}%`;
    card.style.top = `${p.top}%`;
    card.style.display = 'flex';
    card.classList.remove('unhired-desk', 'fired-warning');

    // Build reporting tag
    let reportingTagHtml = '';
    if (p.mgr === 'tech_pm') {
      reportingTagHtml = '<span class="reporting-tag tag-tech">↳ Tech PM</span>';
    } else if (p.mgr === 'ops_pm') {
      reportingTagHtml = '<span class="reporting-tag tag-ops">↳ Ops PM</span>';
    } else if (p.mgr === 'sdm_lead') {
      reportingTagHtml = '<span class="reporting-tag tag-tech" style="background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.3);">↳ SDM</span>';
    } else if (aid === 'tech_pm' || aid === 'ops_pm' || aid === 'sdm_lead') {
      reportingTagHtml = '<span class="reporting-tag tag-exec">↳ Head PMO</span>';
    } else if (aid === 'devils_advocate') {
      reportingTagHtml = '<span class="reporting-tag" style="background: rgba(239,68,68,0.25); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4);">⚔️ Red Team</span>';
    }

    const deptClass = p.dept === 'tech' ? 'doll-tech' : (p.dept === 'ops' ? 'doll-ops' : (aid === 'devils_advocate' ? 'doll-red' : 'doll-exec'));
    const isExecutive = aid === 'head_pmo';

    // Inject or update 3D Metaphor Doll Workstation
    let workstation = card.querySelector('.metaphor-workstation');
    if (!workstation && !isExecutive) {
      workstation = document.createElement('div');
      card.prepend(workstation);
    }
    if (workstation && !isExecutive) {
      const workstationImg = getAgentWorkstationImage(aid);
      workstation.className = 'metaphor-workstation 3d-doll-workstation';
      workstation.innerHTML = `
        <div class="workstation-3d-wrapper">
          <div class="doll-domain-badge ${deptClass}">${avatar}</div>
          <img src="${workstationImg}?v=manager_pods_v18" class="doll-3d-workstation-img" alt="${title} Wooden Doll Workstation">
        </div>
      `;
    }

    // Ensure floating pill has title & reporting tag
    let pill = card.querySelector('.floating-agent-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.className = `floating-agent-pill ${aid === 'head_pmo' ? 'tier1-pill' : (aid === 'tech_pm' || aid === 'ops_pm' ? 'tier2-pill' : (aid === 'devils_advocate' ? 'red-team-pill' : 'tier3-pill'))}`;
      card.appendChild(pill);
    }
    pill.innerHTML = `
      <span class="pill-avatar">${avatar}</span>
      <span class="pill-title">${title}</span>
      ${reportingTagHtml}
      <span class="active-dot">● Active</span>
    `;

    // Ensure thinking banner and speech bubble exist
    if (!card.querySelector('.thinking-cloud')) {
      const think = document.createElement('div');
      think.className = 'thinking-cloud';
      think.id = `think-${aid}`;
      think.style.display = 'none';
      think.innerHTML = `<span class="think-pulse">💭</span><span class="think-text">Analyzing Domain...</span>`;
      card.appendChild(think);
    }
    if (!card.querySelector('.speech-bubble-popup')) {
      const bubble = document.createElement('div');
      bubble.className = `speech-bubble-popup placement-side-left`;
      bubble.id = `bubble-${aid}`;
      bubble.style.display = 'none';
      bubble.innerHTML = `
        <div class="bubble-header">
          <span class="agent-title-tag">${avatar} ${title}</span>
          <span class="phase-tag" id="phase-${aid}">Phase 3</span>
        </div>
        <div class="bubble-body custom-scrollbar" id="text-${aid}"></div>
      `;
      card.appendChild(bubble);
    }
  });

  // Hide static full-canvas table overlays when in dynamic mode with > 7 agents so they don't visually interfere
  const tblOverlay = document.getElementById('office-tables-overlay');
  const dollOverlay = document.getElementById('office-dolls-overlay');
  if (tblOverlay) {
    tblOverlay.style.display = totalCount <= 7 ? 'block' : 'none';
  }
  if (dollOverlay) {
    document.querySelectorAll('.doll-layer').forEach(dl => {
      if (dl.id !== 'doll-head_pmo') {
        dl.style.display = totalCount <= 7 ? 'block' : 'none';
      }
    });
  }

  // 5. Draw the corporate hierarchy reporting lines!
  setTimeout(() => {
    drawHierarchyReportingLines();
  }, 100);
}

function handleRosterCommissioned(data) {
  const commissionedIds = data.agents || [];
  const complexity = data.complexity_level || 'Commissioned';
  showToastNotification(`🏢 [Org Commissioned]: ${data.message || `Swarm commissioned with ${commissionedIds.length} agents (${complexity} Complexity)`}`, 'success');

  // Trigger dynamic manager-led pod layout
  layoutManagerLedOffice(data);

  const statusText = document.getElementById('meeting-status-text');
  if (statusText) {
    statusText.innerHTML = `<span class="status-pulse-dot"></span> 👥 ${commissionedIds.length} AI Agents Active (${complexity} Org Hierarchy)`;
  }
}

function showToastNotification(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `stratum-toast toast-${type}`;
  toast.innerHTML = `<span class="toast-dot"></span><span>${msg}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

function updateAgentIndicator(agentId, state) {
  const chip = document.getElementById(`chip-${agentId}`);
  if (!chip) return;

  const indicator = chip.querySelector('.agent-indicator');
  if (indicator) {
    indicator.className = `agent-indicator ${state}`;
  }
}

// PDF UPLOAD & PARSING HANDLER
function initPdfUpload() {
  const fileInput = document.getElementById('pdf-file-input');
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endswith('.pdf')) {
      alert('Only .pdf files are supported.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`PDF Upload Error: ${err.detail || 'Failed to extract text'}`);
        return;
      }

      const data = await res.json();
      attachedPdfText = data.extracted_text;
      attachedPdfName = data.filename;

      showPdfBadge(data.filename, data.char_count);
    } catch (err) {
      console.error('PDF upload exception:', err);
      alert('Failed to upload and parse PDF file.');
    }
  });
}

function showPdfBadge(filename, charCount) {
  const badge = document.getElementById('pdf-file-badge');
  const textElem = document.getElementById('pdf-filename-text');
  const countElem = document.getElementById('pdf-char-count');

  if (badge && textElem && countElem) {
    textElem.textContent = filename;
    countElem.textContent = `(${charCount.toLocaleString()} chars extracted)`;
    badge.style.display = 'inline-flex';
  }
}

function removeAttachedPdf() {
  attachedPdfText = '';
  attachedPdfName = '';
  const badge = document.getElementById('pdf-file-badge');
  const fileInput = document.getElementById('pdf-file-input');
  if (badge) badge.style.display = 'none';
  if (fileInput) fileInput.value = '';
}

// INTERACTION MODE SELECTION & VIEW SWITCHING
function selectInteractionMode(mode) {
  selectedMode = mode;
  document.querySelectorAll('.mode-card').forEach(card => card.classList.remove('selected'));

  const selectedCard = document.getElementById(`mode-card-${mode}`);
  if (selectedCard) selectedCard.classList.add('selected');
}

function switchViewMode(mode) {
  selectedMode = mode;

  // Seamlessly transition out of hero landing into workspace layout
  const landingHero = document.getElementById('landing-hero');
  const mainLayout = document.getElementById('workspace-layout');
  const viewSwitchBar = document.getElementById('view-switch-bar');
  const btnNewInit = document.getElementById('btn-new-initiative-header');

  if (landingHero) landingHero.style.display = 'none';
  if (mainLayout) mainLayout.style.display = 'flex';
  if (viewSwitchBar) viewSwitchBar.style.display = 'flex';
  if (btnNewInit) btnNewInit.style.display = 'inline-flex';

  const chatTab = document.getElementById('tab-mode-chat');
  const meetingTab = document.getElementById('tab-mode-meeting');
  
  const chatCenter = document.getElementById('chat-center-panel');
  const chatSidebarLeft = document.getElementById('chat-sidebar');
  const chatSidebarRight = document.getElementById('chat-sidebar-right');
  const meetingRoom = document.getElementById('meeting-room-view');

  if (mode === 'meeting') {
    if (chatTab) chatTab.classList.remove('active');
    if (meetingTab) meetingTab.classList.add('active');

    if (mainLayout) mainLayout.classList.add('meeting-mode-active');
    if (chatCenter) chatCenter.style.display = 'none';
    if (chatSidebarLeft) chatSidebarLeft.style.display = 'none';
    if (chatSidebarRight) chatSidebarRight.style.display = 'none';
    if (meetingRoom) meetingRoom.style.display = 'flex';
  } else {
    if (chatTab) chatTab.classList.add('active');
    if (meetingTab) meetingTab.classList.remove('active');

    if (mainLayout) mainLayout.classList.remove('meeting-mode-active');
    if (chatCenter) chatCenter.style.display = 'flex';
    if (chatSidebarLeft) chatSidebarLeft.style.display = 'flex';
    if (chatSidebarRight) chatSidebarRight.style.display = 'flex';
    if (meetingRoom) meetingRoom.style.display = 'none';
  }
}

function resetMeetingRoomState() {
  try {
    document.querySelectorAll('.speech-bubble-popup').forEach(b => b.style.display = 'none');
    document.querySelectorAll('.thinking-cloud').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.callout-banner').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.asking-banner').forEach(a => a.style.display = 'none');
    document.querySelectorAll('.desk-hotspot').forEach(c => c.classList.remove('speaking', 'thinking-active', 'targeted-active', 'asking-active'));
    document.querySelectorAll('.doll-layer').forEach(d => d.classList.remove('speaking-doll', 'seated', 'fired'));
    
    document.querySelectorAll('.dynamic-desk-hotspot').forEach(d => d.remove());
    if (typeof allOfficeAgentIds !== 'undefined' && Array.isArray(allOfficeAgentIds)) {
      allOfficeAgentIds.forEach(id => {
        const card = document.getElementById(`meeting-card-${id}`);
        if (card) card.classList.add('unhired-desk');
      });
    }

    const dynChips = document.querySelectorAll('#dynamic-commissioned-container .agent-chip-item');
    dynChips.forEach(c => c.remove());
    const engSec = document.getElementById('dyn-eng-squad-section');
    if (engSec) engSec.style.display = 'none';

    clearEscalationAndRulingLines(true);
    clearTargetCallouts(true);
    const hierGroup = document.getElementById('svg-hierarchy-lines');
    if (hierGroup) hierGroup.innerHTML = '';

    const canvasZoomWrapper = document.getElementById('canvas-zoom-wrapper');
    if (canvasZoomWrapper) {
      canvasZoomWrapper.classList.remove('team-compact', 'team-dense');
    }

    const spotlight = document.getElementById('active-speaker-spotlight');
    if (spotlight) spotlight.style.display = 'none';

    const drawerFeed = document.getElementById('drawer-log-feed');
    if (drawerFeed) drawerFeed.innerHTML = '<div class="drawer-empty-state"><span class="material-icons-outlined">forum</span><p>Swarm turns and debates will stream here in real time.</p></div>';

    const drawerAdr = document.getElementById('drawer-adr-content');
    if (drawerAdr) drawerAdr.innerHTML = '<p class="placeholder-text">The final synthesized Architecture Decision Record will appear here once all phases conclude.</p>';

    document.querySelectorAll('.agent-indicator').forEach(ind => ind.className = 'agent-indicator idle');
  } catch (err) {
    console.warn('Notice in resetMeetingRoomState:', err);
  }
}

function showLandingHero() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action: 'cancel' }));
  }
  resetMeetingRoomState();

  document.getElementById('landing-hero').style.display = 'flex';
  document.getElementById('workspace-layout').style.display = 'none';
  document.getElementById('view-switch-bar').style.display = 'none';
  document.getElementById('btn-new-initiative-header').style.display = 'none';

  const metricsBar = document.getElementById('metrics-dashboard-bar');
  if (metricsBar) metricsBar.style.display = 'none';
  const arbBanner = document.getElementById('arbitration-banner');
  if (arbBanner) arbBanner.style.display = 'none';
}

function showWorkspaceLayout() {
  document.getElementById('landing-hero').style.display = 'none';
  document.getElementById('workspace-layout').style.display = 'flex';
  document.getElementById('view-switch-bar').style.display = 'flex';
  document.getElementById('btn-new-initiative-header').style.display = 'inline-flex';

  if (currentSwarmOrgMode === 'dynamic') {
    setupAutonomousOfficeView();
  } else {
    setupClassicOfficeView();
  }

  switchViewMode(selectedMode);
}

// REAL INTERACTION MEETING ROOM STATE UPDATES
function updateMeetingRoomAgentStatus(agentId, state) {
  const card = document.getElementById(`meeting-card-${agentId}`);
  const thinkCloud = document.getElementById(`think-${agentId}`);
  if (!card) return;

  if (agentId === 'head_pmo' && (state === 'thinking' || state === 'debating')) {
    const headDoll = document.getElementById('doll-head_pmo');
    if (headDoll) {
      headDoll.classList.add('seated');
      headDoll.classList.remove('fired');
    }
    card.classList.remove('unhired-desk');
  }

  if (state === 'thinking' || state === 'debating') {
    card.classList.add('thinking-active');
    card.classList.remove('speaking');
    if (thinkCloud) thinkCloud.style.display = 'flex';
  } else {
    card.classList.remove('thinking-active');
    if (thinkCloud) thinkCloud.style.display = 'none';
  }
}

function updateMeetingRoomSpeech(data) {
  const agentId = data.agent_id;
  const agent = currentAgents[agentId] || { title: agentId, avatar: '🤖', color: '#6366f1' };

  // Hide ALL previous speech bubbles & clear speaking highlights from all cards
  document.querySelectorAll('.speech-bubble-popup').forEach(b => b.style.display = 'none');
  document.querySelectorAll('.desk-hotspot').forEach(c => c.classList.remove('speaking'));
  document.querySelectorAll('.doll-layer').forEach(d => d.classList.remove('speaking-doll'));

  const activeDoll = document.getElementById(`doll-${agentId}`);
  if (activeDoll) {
    activeDoll.classList.add('speaking-doll');
  }

  const card = document.getElementById(`meeting-card-${agentId}`);
  const bubble = document.getElementById(`bubble-${agentId}`);
  const textElem = document.getElementById(`text-${agentId}`);
  const phaseTag = document.getElementById(`phase-${agentId}`);

  if (card) {
    card.classList.add('speaking');
    card.classList.remove('thinking-active');
    
    // Hide thinking cloud when speaking starts
    const thinkCloud = document.getElementById(`think-${agentId}`);
    if (thinkCloud) thinkCloud.style.display = 'none';

    if (bubble && textElem) {
      if (phaseTag) phaseTag.textContent = data.phase || 'Phase Turn';
      textElem.innerHTML = renderMarkdown(data.content);
      bubble.style.display = 'block';
    }

    // Auto scroll card into view smoothly
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Update Bottom-Left Spotlight Box
  const spotlight = document.getElementById('active-speaker-spotlight');
  const spAvatar = document.getElementById('spotlight-avatar');
  const spName = document.getElementById('spotlight-name');
  const spPhase = document.getElementById('spotlight-phase');
  const spBody = document.getElementById('spotlight-body');

  if (spotlight && spName && spBody) {
    if (spAvatar) spAvatar.textContent = agent.avatar || '🤖';
    spName.textContent = agent.title || agentId;
    if (spPhase) spPhase.textContent = data.phase || 'Turn';
    spBody.innerHTML = renderMarkdown(data.content);
    spotlight.style.display = 'block';
  }

  // APPEND TO SWARM DRAWER LOG & EXECUTIVE ADR
  appendDrawerLog(data, agent);

  // DETECT MENTIONS / CALLOUT TARGETS in Speech Content
  detectTargetCallouts(data.content, agentId);
}

// SWARM DRAWER & TRANSCRIPT MANAGEMENT
function toggleSwarmDrawer() {
  const drawer = document.getElementById('swarm-drawer');
  if (drawer) drawer.classList.toggle('open');
}

function switchDrawerTab(tabName) {
  document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.drawer-panel').forEach(p => p.style.display = 'none');

  const activeTab = document.querySelector(`.drawer-tab[data-drawer-tab="${tabName}"]`);
  const activePanel = document.getElementById(`drawer-panel-${tabName}`);

  if (activeTab) activeTab.classList.add('active');
  if (activePanel) activePanel.style.display = 'block';
}

function appendDrawerLog(data, agent) {
  const feed = document.getElementById('drawer-log-feed');
  const adrContent = document.getElementById('drawer-adr-content');

  if (data.type === 'deliverable') {
    if (adrContent) adrContent.innerHTML = renderMarkdown(data.content);
    return;
  }

  if (!feed) return;

  const emptyState = feed.querySelector('.drawer-empty-state');
  if (emptyState) emptyState.remove();

  const card = document.createElement('div');
  card.className = 'drawer-log-card';
  card.innerHTML = `
    <div class="drawer-log-header">
      <span>${agent.avatar || '🤖'} ${agent.title || data.agent_id}</span>
      <span class="phase-tag">${data.phase || ''}</span>
    </div>
    <div class="drawer-log-content">
      ${renderMarkdown(data.content)}
    </div>
  `;

  feed.appendChild(card);
  
  // Auto scroll panel with visible high-contrast scrollbar
  const panel = document.getElementById('drawer-panel-transcript');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function copyDrawerAdr() {
  const adrElem = document.getElementById('drawer-adr-content');
  if (adrElem) {
    navigator.clipboard.writeText(adrElem.innerText);
    alert('Executive ADR Blueprint copied to clipboard!');
  }
}

let targetCalloutCleanupTimer = null;

function clearTargetCallouts(immediate = false) {
  if (targetCalloutCleanupTimer) {
    clearTimeout(targetCalloutCleanupTimer);
    targetCalloutCleanupTimer = null;
  }
  const svgGroup = document.getElementById('svg-connections-group');
  const clearBanners = () => {
    document.querySelectorAll('.callout-banner').forEach(b => b.style.display = 'none');
    document.querySelectorAll('.asking-banner').forEach(b => b.style.display = 'none');
    document.querySelectorAll('.desk-hotspot').forEach(c => c.classList.remove('targeted-active', 'asking-active'));
  };

  if (!svgGroup) {
    clearBanners();
    return;
  }

  if (immediate) {
    svgGroup.innerHTML = '';
    svgGroup.style.opacity = '1';
    clearBanners();
    return;
  }

  svgGroup.style.transition = 'opacity 0.6s ease';
  svgGroup.style.opacity = '0';
  setTimeout(() => {
    svgGroup.innerHTML = '';
    svgGroup.style.opacity = '1';
    svgGroup.style.transition = '';
    clearBanners();
  }, 600);
}

// Detect `@AgentName` mentions and trigger SVG connecting lines + dual badges
function detectTargetCallouts(content, speakerId) {
  // Clear previous question/clarification lines immediately
  clearTargetCallouts(true);

  if (!content) return;

  const agentMentionMap = {
    '@cloudarchitect': 'cloud_architect',
    '@costauditor': 'cost_auditor',
    '@securityofficer': 'security_officer',
    '@securitylead': 'security_officer',
    '@ciso': 'security_officer',
    '@qalead': 'qa_lead',
    '@engineeringpm': 'tech_pm',
    '@techpm': 'tech_pm',
    '@opspm': 'ops_pm',
    '@headofpmo': 'head_pmo',
    '@devops': 'devops_engineer',
    '@dataengineer': 'data_engineer',
    '@riskanalyst': 'risk_analyst',
    '@databasespecialist': 'database_specialist',
    '@complianceauditor': 'compliance_auditor',
    '@performanceengineer': 'performance_engineer',
    '@devilsadvocate': 'devils_advocate',
    '@redteam': 'devils_advocate'
  };

  const lowerContent = content.toLowerCase();
  const speakerCard = document.getElementById(`meeting-card-${speakerId}`);
  let hasMention = false;

  for (const [mentionTag, targetAgentId] of Object.entries(agentMentionMap)) {
    if (lowerContent.includes(mentionTag) && targetAgentId !== speakerId) {
      hasMention = true;
      const targetCard = document.getElementById(`meeting-card-${targetAgentId}`);
      const targetCallout = document.getElementById(`callout-${targetAgentId}`);
      const speakerAsking = document.getElementById(`asking-${speakerId}`);

      if (speakerCard) {
        speakerCard.classList.add('asking-active');
      }
      if (speakerAsking) {
        const targetTitle = (currentAgents[targetAgentId] || {}).title || targetAgentId;
        speakerAsking.textContent = `❓ ASKING @${targetTitle.replace(/\s+/g, '')}`;
        speakerAsking.style.display = 'block';
      }

      if (targetCard) {
        targetCard.classList.add('targeted-active');
      }
      if (targetCallout) {
        const speakerTitle = (currentAgents[speakerId] || {}).title || speakerId;
        targetCallout.textContent = `🎯 TARGETED BY ${speakerTitle.toUpperCase()}`;
        targetCallout.style.display = 'block';
      }

      // Draw SVG connecting line
      drawSvgConnectionLine(speakerId, targetAgentId);
    }
  }

  // Auto clean-up question lines and target banners after 5 seconds so screen stays clean!
  if (hasMention) {
    targetCalloutCleanupTimer = setTimeout(() => {
      clearTargetCallouts(false);
    }, 5000);
  }
}

// Draw dynamic SVG curve line from speaker to target agent
function drawSvgConnectionLine(speakerId, targetAgentId) {
  const viewport = document.querySelector('.office-viewport');
  const speakerCard = document.getElementById(`meeting-card-${speakerId}`);
  const targetCard = document.getElementById(`meeting-card-${targetAgentId}`);
  const svgGroup = document.getElementById('svg-connections-group');

  if (!viewport || !speakerCard || !targetCard || !svgGroup) return;

  const vRect = viewport.getBoundingClientRect();
  const sRect = speakerCard.getBoundingClientRect();
  const tRect = targetCard.getBoundingClientRect();

  const x1 = sRect.left + sRect.width / 2 - vRect.left;
  const y1 = sRect.top + sRect.height / 2 - vRect.top;
  const x2 = tRect.left + tRect.width / 2 - vRect.left;
  const y2 = tRect.top + tRect.height / 2 - vRect.top;

  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - 40;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
  path.setAttribute('stroke', '#ec4899');
  path.setAttribute('stroke-width', '3.5');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-dasharray', '8 6');
  path.setAttribute('marker-end', 'url(#qa-arrow)');
  path.setAttribute('filter', 'url(#line-glow)');
  path.setAttribute('class', 'animated-qa-line');

  svgGroup.appendChild(path);
}

// =========================================================================
// AI INFERENCE PROVIDER STATE & OPENROUTER GEMMA MODELS
// =========================================================================
let currentProvider = localStorage.getItem('pmo_provider') || 'local';
let openrouterApiKey = localStorage.getItem('pmo_openrouter_key') || '';

let openRouterGemmaModels = [
  { id: 'google/gemma-4-31b-it:free', name: '🆓 Google: Gemma 4 31B Instruct (100% Free Tier - 262k)' },
  { id: 'google/gemma-4-26b-a4b-it:free', name: '🆓 Google: Gemma 4 26B A4B Instruct (100% Free Tier - 262k)' },
  { id: 'google/gemma-4-31b-it', name: '💳 Google: Gemma 4 31B Instruct (Paid Tier / High Quota - 262k)' },
  { id: 'google/gemma-4-26b-a4b-it', name: '💳 Google: Gemma 4 26B A4B Instruct (Paid Tier / High Quota - 262k)' },
  { id: 'custom', name: '✏️ Custom Model ID...' }
];

let localModelsList = [
  { id: 'deepseek/deepseek-r1-0528-qwen3-8b', name: '🐳 DeepSeek R1 Qwen3 8B (Recommended)' },
  { id: 'google/gemma-4-12b-qat', name: '🧠 Gemma 4 12B QAT' },
  { id: 'google/gemma-4-e2b', name: '⚡ Gemma 4 e2B (Ultra Fast)' },
  { id: 'google/gemma-4-2b', name: 'Gemma 4 2B' },
  { id: 'deepseek-r1', name: 'DeepSeek R1' },
  { id: 'deepseek-v3', name: 'DeepSeek V3' },
  { id: 'custom', name: '✏️ Custom Model...' }
];

function populateModelDropdowns(modelsList) {
  const targetDropdownIds = [
    'hero-model-tier1', 'hero-model-tier2', 'hero-model-tier3', 'hero-model-red',
    'modal-model-tier1', 'modal-model-tier2', 'modal-model-tier3', 'modal-model-red'
  ];

  targetDropdownIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prevVal = sel.value;
    sel.innerHTML = '';
    modelsList.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      sel.appendChild(opt);
    });
    if (prevVal && modelsList.some(m => m.id === prevVal)) {
      sel.value = prevVal;
    } else {
      sel.selectedIndex = 0;
    }
  });

  // Also update per-agent override dropdowns
  document.querySelectorAll('.agent-model-select').forEach(sel => {
    const prevVal = sel.value;
    const inheritLabel = sel.options[0]?.textContent || '(Inherit Tier Settings)';
    sel.innerHTML = `<option value="">${inheritLabel}</option>`;
    modelsList.forEach(m => {
      if (m.id !== 'custom') {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        sel.appendChild(opt);
      }
    });
    if (prevVal) sel.value = prevVal;
  });
}

function switchProvider(provider) {
  currentProvider = provider;
  localStorage.setItem('pmo_provider', provider);

  // Sync Provider Toggle Buttons
  const isLocal = (provider === 'local');
  const btnLocal = document.getElementById('btn-provider-local');
  const btnOR = document.getElementById('btn-provider-openrouter');
  const modalBtnLocal = document.getElementById('modal-provider-local');
  const modalBtnOR = document.getElementById('modal-provider-openrouter');

  if (btnLocal) btnLocal.classList.toggle('active', isLocal);
  if (btnOR) btnOR.classList.toggle('active', !isLocal);
  if (modalBtnLocal) modalBtnLocal.classList.toggle('active', isLocal);
  if (modalBtnOR) modalBtnOR.classList.toggle('active', !isLocal);

  // Toggle OpenRouter Key Input Bar Visibility
  const heroKeyBar = document.getElementById('openrouter-controls-bar');
  const modalKeyBar = document.getElementById('modal-openrouter-controls-bar');
  if (heroKeyBar) heroKeyBar.style.display = isLocal ? 'none' : 'block';
  if (modalKeyBar) modalKeyBar.style.display = isLocal ? 'none' : 'block';

  // Populate Key into Inputs
  if (!isLocal) {
    if (document.getElementById('openrouter-api-key')) {
      document.getElementById('openrouter-api-key').value = openrouterApiKey;
    }
    if (document.getElementById('modal-openrouter-api-key')) {
      document.getElementById('modal-openrouter-api-key').value = openrouterApiKey;
    }
  }

  // Update Section Subtitles & Icons
  const heroTitle = document.getElementById('hero-bar-title');
  const heroSubtitle = document.getElementById('hero-bar-subtitle');
  const heroIcon = document.getElementById('hero-bar-icon');
  const modalDesc = document.getElementById('modal-desc-text');

  if (isLocal) {
    if (heroTitle) heroTitle.textContent = 'Swarm Model Architecture (Local LM Studio)';
    if (heroSubtitle) heroSubtitle.textContent = 'Live local LM Studio models powering your active PMO swarm';
    if (heroIcon) heroIcon.textContent = '⚡';
    if (modalDesc) modalDesc.textContent = 'Configure local LM Studio models and endpoints. Serialized single-stream execution active.';
  } else {
    if (heroTitle) heroTitle.textContent = 'Swarm Model Architecture (OpenRouter Cloud)';
    if (heroSubtitle) heroSubtitle.textContent = 'Cloud High-Speed Gemma models via OpenRouter (Multi-Stream Parallelism Active)';
    if (heroIcon) heroIcon.textContent = '🚀';
    if (modalDesc) modalDesc.textContent = 'Cloud High-Speed Gemma models via OpenRouter. 6 concurrent streams unlocked across all agents!';
  }

  // Update Quick Preset Buttons
  renderPresetButtons(isLocal);

  // Switch Dropdowns between Local catalog and OpenRouter Gemma catalog
  const models = isLocal ? localModelsList : openRouterGemmaModels;
  populateModelDropdowns(models);

  // If switched to OpenRouter, default to 100% Free Tier Gemma 4 models
  if (!isLocal) {
    applyModelPreset('gemma4_free');
  } else {
    applyModelPreset('hybrid');
  }

  // Update Endpoint URLs in Modal Form
  const defaultUrl = isLocal ? 'http://127.0.0.1:1234/v1' : 'https://openrouter.ai/api/v1';
  ['modal-url-tier1', 'modal-url-tier2', 'modal-url-tier3'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = defaultUrl;
  });

  // Auto-sync with backend
  saveModelConfig(true);
}

function renderPresetButtons(isLocal) {
  const heroPresets = document.getElementById('hero-model-presets');
  const modalPresets = document.getElementById('modal-presets-bar');

  let html = '';
  if (isLocal) {
    html = `
      <span class="preset-label">Quick Presets:</span>
      <button type="button" class="preset-pill" onclick="applyModelPreset('deepseek_r1')">🐳 DeepSeek R1 8B</button>
      <button type="button" class="preset-pill" onclick="applyModelPreset('hybrid')">⚡ Hybrid Engine</button>
      <button type="button" class="preset-pill" onclick="applyModelPreset('2b_all')">🚀 All Gemma 2B</button>
      <button type="button" class="preset-pill" onclick="applyModelPreset('12b_all')">🧠 All Gemma 12B</button>
    `;
  } else {
    html = `
      <span class="preset-label">Gemma 4 Presets:</span>
      <button type="button" class="preset-pill" onclick="applyModelPreset('gemma4_31b')">👑 Gemma 4 31B All</button>
      <button type="button" class="preset-pill" onclick="applyModelPreset('gemma4_26b')">⚡ Gemma 4 26B Fast</button>
      <button type="button" class="preset-pill" onclick="applyModelPreset('gemma4_free')">🆓 Gemma 4 Free Tier</button>
      <button type="button" class="preset-pill" onclick="applyModelPreset('gemma4_hybrid')">🚀 Hybrid (31B Exec / 26B PMs)</button>
    `;
  }

  if (heroPresets) {
    heroPresets.innerHTML = '';
    heroPresets.style.display = 'none';
  }
  if (modalPresets) {
    const modalHtml = html.replace(/preset-pill/g, 'preset-tag');
    modalPresets.innerHTML = modalHtml;
  }
}

function onApiKeyChanged(val) {
  openrouterApiKey = (val || '').trim();
  localStorage.setItem('pmo_openrouter_key', openrouterApiKey);

  const heroKey = document.getElementById('openrouter-api-key');
  const modalKey = document.getElementById('modal-openrouter-api-key');
  if (heroKey && heroKey.value !== openrouterApiKey) heroKey.value = openrouterApiKey;
  if (modalKey && modalKey.value !== openrouterApiKey) modalKey.value = openrouterApiKey;

  showToastNotification('🔑 OpenRouter API key saved locally!', 'info');
  saveModelConfig(true);

  if (openrouterApiKey.length > 15) {
    fetchOpenRouterModels();
  }
}

function toggleApiKeyVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    if (icon) icon.textContent = 'visibility';
  }
}

async function fetchOpenRouterModels() {
  showToastNotification('🔄 Querying OpenRouter for live Gemma models...', 'info');
  try {
    const keyParam = openrouterApiKey ? `?api_key=${encodeURIComponent(openrouterApiKey)}` : '';
    const res = await fetch(`/api/openrouter/models${keyParam}`);
    const data = await res.json();
    if (data.models && data.models.length > 0) {
      openRouterGemmaModels = data.models;
      if (!openRouterGemmaModels.some(m => m.id === 'custom')) {
        openRouterGemmaModels.push({ id: 'custom', name: '✏️ Custom Model ID...' });
      }
      if (currentProvider === 'openrouter') {
        populateModelDropdowns(openRouterGemmaModels);
      }
      showToastNotification(`✅ Discovered ${data.models.length} Gemma models on OpenRouter!`, 'success');
    }
  } catch (e) {
    console.error('Failed to fetch OpenRouter models:', e);
    showToastNotification('⚠️ Could not refresh live models. Using standard Gemma catalog.', 'warning');
  }
}

// UNIFIED SWARM MODEL ARCHITECTURE SYNCHRONIZATION
function openModelModal() {
  const modal = document.getElementById('tier-modal');
  if (modal) modal.style.display = 'flex';
}

function closeModelModal() {
  const modal = document.getElementById('tier-modal');
  if (modal) modal.style.display = 'none';
}

function setDropdownValue(elemId, value) {
  const elem = document.getElementById(elemId);
  if (!elem || !value) return;
  let found = false;
  for (let i = 0; i < elem.options.length; i++) {
    if (elem.options[i].value === value) {
      elem.selectedIndex = i;
      found = true;
      break;
    }
  }
  if (!found) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = `⚡ ${value}`;
    elem.appendChild(opt);
    elem.value = value;
  }
}

function syncModelSelection(role, modelName) {
  if (role === 'tier1') {
    setDropdownValue('hero-model-tier1', modelName);
    setDropdownValue('modal-model-tier1', modelName);
    const tag = document.getElementById('tier1-model-name');
    if (tag) tag.textContent = modelName;
    if (currentConfig.tier1) currentConfig.tier1.model_name = modelName;
  } else if (role === 'tier2') {
    setDropdownValue('hero-model-tier2', modelName);
    setDropdownValue('modal-model-tier2', modelName);
    const tag = document.getElementById('tier2-model-name');
    if (tag) tag.textContent = modelName;
    if (currentConfig.tier2) currentConfig.tier2.model_name = modelName;
  } else if (role === 'tier3') {
    setDropdownValue('hero-model-tier3', modelName);
    setDropdownValue('modal-model-tier3', modelName);
    const tag = document.getElementById('tier3-model-name');
    if (tag) tag.textContent = modelName;
    if (currentConfig.tier3) currentConfig.tier3.model_name = modelName;
  } else if (role === 'red') {
    setDropdownValue('hero-model-red', modelName);
    setDropdownValue('modal-model-red', modelName);
    const agentRed = document.getElementById('agent-model-devils_advocate');
    if (agentRed) agentRed.value = modelName;
    if (!currentAgents.devils_advocate) currentAgents.devils_advocate = {};
    currentAgents.devils_advocate.model_name = modelName;
  }

  updateConnectionStatus('connected');
  // Auto-persist silently so changes are always synchronized
  saveModelConfig(true);
}

function updateModelTags(data) {
  if (!data) return;
  const config = data.config || data.model_tiers || data;
  const agents = data.agents || currentAgents || {};

  const t1 = config.tier1?.model_name || 'deepseek/deepseek-r1-0528-qwen3-8b';
  const t2 = config.tier2?.model_name || 'google/gemma-4-12b-qat';
  const t3 = config.tier3?.model_name || 'google/gemma-4-e2b';
  const red = agents.devils_advocate?.model_name || t1;

  setDropdownValue('hero-model-tier1', t1);
  setDropdownValue('modal-model-tier1', t1);
  setDropdownValue('hero-model-tier2', t2);
  setDropdownValue('modal-model-tier2', t2);
  setDropdownValue('hero-model-tier3', t3);
  setDropdownValue('modal-model-tier3', t3);
  setDropdownValue('hero-model-red', red);
  setDropdownValue('modal-model-red', red);

  if (document.getElementById('modal-url-tier1') && config.tier1?.base_url) {
    document.getElementById('modal-url-tier1').value = config.tier1.base_url;
  }
  if (document.getElementById('modal-url-tier2') && config.tier2?.base_url) {
    document.getElementById('modal-url-tier2').value = config.tier2.base_url;
  }
  if (document.getElementById('modal-url-tier3') && config.tier3?.base_url) {
    document.getElementById('modal-url-tier3').value = config.tier3.base_url;
  }

  // Update Left PMO Roster tags
  if (document.getElementById('tier1-model-name')) document.getElementById('tier1-model-name').textContent = t1;
  if (document.getElementById('tier2-model-name')) document.getElementById('tier2-model-name').textContent = t2;
  if (document.getElementById('tier3-model-name')) document.getElementById('tier3-model-name').textContent = t3;

  // Update 11 agent overrides
  if (agents) {
    for (const [agentId, agentObj] of Object.entries(agents)) {
      const selectElem = document.getElementById(`agent-model-${agentId}`);
      if (selectElem && agentObj.model_name) {
        selectElem.value = agentObj.model_name;
      }
    }
  }

  updateConnectionStatus('connected');
}

async function downloadExecutivePDF() {
  showToastNotification('📥 Compiling Complete Multi-Agent Transcript & Codebase PDF...', 'info');
  try {
    // 1. Gather all transcript events from memory buffer
    let transcriptsToSend = (window.activeSessionTranscripts && window.activeSessionTranscripts.length) 
      ? [...window.activeSessionTranscripts] 
      : [];

    // 2. Fallback: scrape live transcript feed from DOM cards if buffer was cleared
    if (!transcriptsToSend.length) {
      const feedCards = document.querySelectorAll('#transcript-feed .speech-card');
      feedCards.forEach(card => {
        const avatar = card.querySelector('.bubble-avatar')?.textContent?.trim() || '👤';
        const title = card.querySelector('.speaker-name')?.textContent?.trim() || 'Agent';
        const phase = card.querySelector('.phase-tag')?.textContent?.trim() || 'War Room';
        const text = card.querySelector('.bubble-text')?.textContent?.trim() || '';
        const isRed = card.classList.contains('debate') || card.classList.contains('pre_mortem');
        if (text) {
          transcriptsToSend.push({
            agent_id: card.getAttribute('data-agent') || 'agent',
            title: title,
            avatar: avatar,
            phase: phase,
            content: text,
            type: isRed ? 'pre_mortem' : 'speech'
          });
        }
      });
    }

    // 3. Gather active ADR text
    const adrEl = document.getElementById('drawer-adr-content') || document.getElementById('deliverable-content');
    const adrText = (typeof currentAdrText !== 'undefined' && currentAdrText && currentAdrText.trim()) 
      ? currentAdrText 
      : (adrEl ? adrEl.textContent.trim() : '');

    // 4. Gather active repo slug
    const repoSlug = (typeof currentRepoSlug !== 'undefined' && currentRepoSlug) ? currentRepoSlug : null;

    const res = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcripts: transcriptsToSend.length ? transcriptsToSend : null,
        adr: adrText || null,
        repo_slug: repoSlug
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = `Server returned ${res.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.detail) errMsg = errJson.detail;
      } catch (_) {}
      showToastNotification(`⚠️ PDF export failed: ${errMsg}`, 'error');
      return;
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const cleanSlug = repoSlug ? `_${repoSlug}` : '';
    a.download = `The_Boardroom_Executive_Report${cleanSlug}_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
    showToastNotification('✅ Executive PDF Report with Transcripts & Codebase downloaded!', 'success');
  } catch (err) {
    console.error('Error downloading executive PDF:', err);
    showToastNotification(`⚠️ Network error downloading PDF: ${err.message}`, 'error');
  }
}

function renderMarkdown(text) {
  if (!text) return "";
  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    try {
      marked.setOptions({
        gfm: true,
        breaks: true
      });
      return marked.parse(text);
    } catch (e) {
      console.error('Marked parsing error:', e);
    }
  }
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// Append Speech / Thought / Debate Cards to Chat Transcript Feed
function appendSpeechCard(data) {
  const feed = document.getElementById('transcript-feed');
  if (!feed) return;

  const emptyState = feed.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const agent = currentAgents[data.agent_id] || { title: data.agent_id, avatar: '🤖', color: '#1a73e8', tier: 'tier3' };

  if (data.type === 'deliverable') {
    const deliverableBody = document.getElementById('deliverable-body');
    if (deliverableBody) deliverableBody.innerHTML = renderMarkdown(data.content);
    return;
  }

  const card = document.createElement('div');
  card.className = `speech-card ${data.type}`;
  card.dataset.tier = agent.tier;

  const renderedContent = renderMarkdown(data.content);

  card.innerHTML = `
    <div class="avatar-col">
      <div class="speech-avatar" style="border-color: ${agent.color}">${agent.avatar}</div>
    </div>
    <div class="bubble-container">
      <div class="speech-header">
        <span class="speech-name">${agent.title}</span>
        <span class="speech-phase">${data.phase}</span>
      </div>
      <div class="bubble-content" style="border-left: 3px solid ${agent.color}">
        ${renderedContent}
      </div>
    </div>
  `;

  feed.appendChild(card);
  applyFeedFilters();
  feed.scrollTop = feed.scrollHeight;
}

// Model Preset Handler for Swarm Architecture
function applyModelPreset(preset) {
  let m1 = '', m2 = '', m3 = '', mRed = '';
  if (preset === 'deepseek_r1') {
    m1 = m2 = m3 = mRed = 'deepseek/deepseek-r1-0528-qwen3-8b';
  } else if (preset === 'hybrid') {
    m1 = 'deepseek/deepseek-r1-0528-qwen3-8b';
    m2 = 'google/gemma-4-12b-qat';
    m3 = 'google/gemma-4-e2b';
    mRed = 'deepseek/deepseek-r1-0528-qwen3-8b';
  } else if (preset === '2b_all') {
    m1 = m2 = m3 = mRed = 'google/gemma-4-e2b';
  } else if (preset === '12b_all') {
    m1 = m2 = m3 = mRed = 'google/gemma-4-12b-qat';
  } else if (preset === 'gemma4_31b' || preset === 'openrouter_27b') {
    m1 = m2 = m3 = mRed = 'google/gemma-4-31b-it';
  } else if (preset === 'gemma4_26b' || preset === 'openrouter_9b') {
    m1 = m2 = m3 = mRed = 'google/gemma-4-26b-a4b-it';
  } else if (preset === 'gemma4_free' || preset === 'openrouter_free') {
    m1 = mRed = 'google/gemma-4-31b-it:free';
    m2 = m3 = 'google/gemma-4-26b-a4b-it:free';
  } else if (preset === 'gemma4_hybrid' || preset === 'openrouter_hybrid') {
    m1 = 'google/gemma-4-31b-it';
    m2 = 'google/gemma-4-26b-a4b-it';
    m3 = 'google/gemma-4-26b-a4b-it';
    mRed = 'google/gemma-4-31b-it';
  }

  // Sync all 4 core tiers simultaneously
  syncModelSelection('tier1', m1);
  syncModelSelection('tier2', m2);
  syncModelSelection('tier3', m3);
  syncModelSelection('red', mRed);

  // Clear per-agent overrides so they inherit tier settings
  document.querySelectorAll('.agent-model-select').forEach(sel => sel.value = '');

  showToastNotification(`⚡ Swarm preset '${preset}' applied across all roles!`, 'info');
}

// Preset Handlers
function setPreset(num) {
  const input = document.getElementById('hero-prompt-input');
  if (!input) return;
  const prompt = presetPrompts[num] || presetPrompts[1];
  input.value = prompt;
  showToastNotification('📋 Scenario loaded! Click "Launch PMO Initiative" or run directly.', 'info');
}

// DOM Event Listeners
function initEventListeners() {
  const btnStartHero = document.getElementById('btn-start-hero');
  if (btnStartHero) {
    btnStartHero.addEventListener('click', startInitiativeFromHero);
  }

  const btnLogo = document.getElementById('btn-home-logo');
  if (btnLogo) {
    btnLogo.addEventListener('click', showLandingHero);
  }

  // Filters
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      activeFilter = e.target.dataset.filter;
      applyFeedFilters();
    });
  });

  // Copy ADR
  const btnCopy = document.getElementById('btn-copy-adr');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      const body = document.getElementById('deliverable-body');
      navigator.clipboard.writeText(body.innerText);
      alert('Executive ADR copied to clipboard!');
    });
  }

  // Modal Listeners
  const btnOpen = document.getElementById('btn-open-tier-modal');
  if (btnOpen) btnOpen.addEventListener('click', openModelModal);
  const btnClose = document.getElementById('btn-close-modal');
  if (btnClose) btnClose.addEventListener('click', closeModelModal);
  const btnCancel = document.getElementById('btn-cancel-modal');
  if (btnCancel) btnCancel.addEventListener('click', closeModelModal);

  const configForm = document.getElementById('tier-config-form');
  if (configForm) {
    configForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveModelConfig(false);
    });
  }
}

let _isHeroInitiativeLaunching = false;
function startInitiativeFromHero() {
  if (_isHeroInitiativeLaunching) return;
  _isHeroInitiativeLaunching = true;
  setTimeout(() => { _isHeroInitiativeLaunching = false; }, 1500);

  const input = document.getElementById('hero-prompt-input');
  let prompt = input ? input.value.trim() : '';

  // If empty and no PDF, default to Amazon Retail Challenge 08 so it NEVER blocks!
  if (!prompt && !attachedPdfText) {
    prompt = presetPrompts[1];
  } else if (attachedPdfText) {
    prompt = `Executive Request: ${prompt || 'Analyze requirements and architect PMO solution.'}\n\nAttached Requirement Document (${attachedPdfName}):\n${attachedPdfText}`;
  }

  launchSwarmFromWorkspace(prompt);
}

const presetPrompts = {
  1: `# PMO SWARM CHALLENGE 08: AMAZON RETAIL — INVENTORY CONSISTENCY AND OVERSOLD ORDERS

1. Executive Problem Statement
During a major flash-sale event, the retail platform experienced critical inventory discrepancies resulting in 12,400 oversold orders across three regional fulfillment centers. Regional inventory replicas diverged under high concurrency (65,000 requests/sec peak), leading to duplicate reservation allocations and ledger drift.

Evaluate Option A (Strongly Consistent Multi-Region Distributed Transactions), Option B (Regional Reservations With Asynchronous Ledger Reconciliation), and Option C (Partitioned Single-Writer Inventory Domains). Determine the optimal architectural strategy, financial feasibility, and phased mitigation plan under strict corporate FinOps budget caps ($4.0M implementation, $6.2M annual OpEx).`,
  2: `Architect a high-performance Zero-Trust Banking Payment Gateway complying with PCI-DSS Level 1 and SOC2 Type II standards under a strict $3.5M budget cap. Sub-50ms P99 latency and automated compliance telemetry required.`,
  3: `Design an enterprise event stream processing platform capable of handling 10,000,000 events/minute with strict exactly-once processing semantics, idempotent deduplication windows, and automated regional failover.`
};

function selectPreset(num) {
  const prompt = presetPrompts[num] || presetPrompts[1];
  const heroInput = document.getElementById('hero-prompt-input');
  if (heroInput) {
    heroInput.value = prompt;
    heroInput.focus();
  }
}

function setAndLaunchPreset(num) {
  selectPreset(num);
  startInitiativeFromHero();
}

function launchSwarmFromWorkspace(overridePrompt) {
  const heroInput = document.getElementById('hero-prompt-input');

  let prompt = overridePrompt || (heroInput && heroInput.value.trim()) || '';

  // If empty and no PDF attached, default to Amazon Retail Challenge 08 so user gets immediate motion
  if (!prompt && !attachedPdfText) {
    prompt = presetPrompts[1];
  } else if (attachedPdfText) {
    prompt = `Executive Request: ${prompt || 'Analyze requirements and architect PMO solution.'}\n\nAttached Requirement Document (${attachedPdfName}):\n${attachedPdfText}`;
  }

  // Ensure workspace view is visible and hero is hidden
  showWorkspaceLayout();

  // Clear chat feed & reset meeting room state
  const feed = document.getElementById('transcript-feed');
  if (feed) feed.innerHTML = '';

  resetMeetingRoomState();

  // Show status banner with live spinner in Chat View
  const statusBanner = document.getElementById('status-banner');
  const statusMsg = document.getElementById('status-message');
  if (statusBanner && statusMsg) {
    statusBanner.style.display = 'flex';
    statusMsg.textContent = '⚡ PMO Swarm Initializing Phase 0 (Executive Org Architecture)...';
  }

  // Show status in Meeting Room View
  const meetingStatus = document.getElementById('meeting-status-text');
  if (meetingStatus) {
    meetingStatus.innerHTML = '<span class="status-pulse-dot"></span> ⚡ Swarm Active · Head of PMO Assessing Complexity...';
  }

  showToastNotification('🚀 PMO Swarm Launched! Head of PMO is assessing problem complexity...', 'success');

  const payload = JSON.stringify({ action: 'run', prompt: prompt, mode: currentSwarmOrgMode });
  console.log('🚀 Sending PMO Run Initiative:', { mode: currentSwarmOrgMode, promptLength: prompt.length });

  let sentViaWs = false;
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(payload);
      sentViaWs = true;
      console.log('✅ Sent run action over WebSocket');
    } catch (wsErr) {
      console.warn('WebSocket send error:', wsErr);
    }
  }

  if (!sentViaWs) {
    fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, mode: currentSwarmOrgMode })
    }).then(res => {
      console.log('✅ Sent run action over HTTP /api/run, status:', res.status);
    }).catch(err => {
      console.error('Run API Error:', err);
    });
  }
}


async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    currentConfig = data.model_tiers;
    if (data.agents) currentAgents = data.agents;

    if (data.openrouter_gemma_models && data.openrouter_gemma_models.length > 0) {
      openRouterGemmaModels = data.openrouter_gemma_models;
      if (!openRouterGemmaModels.some(m => m.id === 'custom')) {
        openRouterGemmaModels.push({ id: 'custom', name: '✏️ Custom Model ID...' });
      }
    }

    // Determine initial provider (preference: localStorage > server config > 'local')
    const savedProvider = localStorage.getItem('pmo_provider') || data.provider || 'local';
    const savedKey = localStorage.getItem('pmo_openrouter_key') || '';
    if (savedKey) {
      openrouterApiKey = savedKey;
      if (document.getElementById('openrouter-api-key')) document.getElementById('openrouter-api-key').value = savedKey;
      if (document.getElementById('modal-openrouter-api-key')) document.getElementById('modal-openrouter-api-key').value = savedKey;
    } else if (data.masked_api_key) {
      if (document.getElementById('openrouter-api-key')) document.getElementById('openrouter-api-key').placeholder = `Active Key: ${data.masked_api_key}`;
      if (document.getElementById('modal-openrouter-api-key')) document.getElementById('modal-openrouter-api-key').placeholder = `Active Key: ${data.masked_api_key}`;
    }

    switchProvider(savedProvider);
    updateModelTags(data);
  } catch (e) {
    console.error('Error loading config:', e);
  }
}

async function saveModelConfig(silent = false) {
  const m1 = document.getElementById('modal-model-tier1')?.value || document.getElementById('hero-model-tier1')?.value;
  const m2 = document.getElementById('modal-model-tier2')?.value || document.getElementById('hero-model-tier2')?.value;
  const m3 = document.getElementById('modal-model-tier3')?.value || document.getElementById('hero-model-tier3')?.value;
  const mRed = document.getElementById('modal-model-red')?.value || document.getElementById('hero-model-red')?.value;

  const defaultUrl = (currentProvider === 'openrouter') ? 'https://openrouter.ai/api/v1' : 'http://127.0.0.1:1234/v1';
  const url1 = document.getElementById('modal-url-tier1')?.value || defaultUrl;
  const url2 = document.getElementById('modal-url-tier2')?.value || defaultUrl;
  const url3 = document.getElementById('modal-url-tier3')?.value || defaultUrl;

  const agentOverrides = {};
  const agentIds = [
    'head_pmo', 'tech_pm', 'ops_pm', 'cloud_architect', 'cost_auditor', 
    'security_officer', 'qa_lead', 'devops_engineer', 'data_engineer', 
    'risk_analyst', 'devils_advocate'
  ];
  
  agentIds.forEach(id => {
    const elem = document.getElementById(`agent-model-${id}`);
    if (elem && elem.value) {
      agentOverrides[id] = { model_name: elem.value };
    }
  });

  // Keep devils advocate aligned with Red Team if not overridden
  if (!agentOverrides['devils_advocate'] && mRed) {
    agentOverrides['devils_advocate'] = { model_name: mRed };
  }

  const payload = {
    provider: currentProvider,
    openrouter_api_key: openrouterApiKey,
    concurrency_limit: (currentProvider === 'openrouter') ? 6 : 1,
    tier1: {
      base_url: (currentProvider === 'openrouter' && (!url1 || url1.includes('127.0.0.1'))) ? 'https://openrouter.ai/api/v1' : url1,
      model_name: m1
    },
    tier2: {
      base_url: (currentProvider === 'openrouter' && (!url2 || url2.includes('127.0.0.1'))) ? 'https://openrouter.ai/api/v1' : url2,
      model_name: m2
    },
    tier3: {
      base_url: (currentProvider === 'openrouter' && (!url3 || url3.includes('127.0.0.1'))) ? 'https://openrouter.ai/api/v1' : url3,
      model_name: m3
    },
    agents: agentOverrides
  };

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    currentConfig = data.config || data.model_tiers;
    if (data.agents) currentAgents = data.agents;

    localStorage.setItem('pmo_swarm_config', JSON.stringify(payload));
    
    if (!silent) {
      updateModelTags(data);
      const providerLabel = (currentProvider === 'openrouter') ? 'OpenRouter Cloud (High-Speed)' : 'Local LM Studio';
      showToastNotification(`✅ Swarm configured for ${providerLabel}!`, 'success');
      closeModelModal();
    }
  } catch (e) {
    console.error('Error saving model config:', e);
    if (!silent) {
      showToastNotification('❌ Error saving model configuration: ' + e.message, 'error');
    }
  }
}

const saveTierConfig = saveModelConfig;

function applyFeedFilters() {
  const cards = document.querySelectorAll('.speech-card');
  cards.forEach(card => {
    if (activeFilter === 'all') {
      card.style.display = 'flex';
    } else if (activeFilter === 'debate') {
      card.style.display = card.classList.contains('debate') ? 'flex' : 'none';
    } else if (activeFilter === 'revert_question') {
      card.style.display = (card.classList.contains('revert_question') || card.classList.contains('revert_answer')) ? 'flex' : 'none';
    } else if (activeFilter === 'tier1') {
      card.style.display = card.dataset.tier === 'tier1' ? 'flex' : 'none';
    }
  });
}

// VIEWPORT PAN & ZOOM CONTROLS
let currentZoom = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

function zoomViewport(delta) {
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));
  if (newZoom === 1.0) {
    panX = 0;
    panY = 0;
  }
  currentZoom = newZoom;
  applyViewportTransform();
}

function resetViewportZoom() {
  currentZoom = 1.0;
  panX = 0;
  panY = 0;
  applyViewportTransform();
}

function applyViewportTransform() {
  const wrapper = document.getElementById('canvas-zoom-wrapper');
  const badge = document.getElementById('zoom-level-badge');
  if (wrapper) {
    wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  }
  if (badge) {
    badge.textContent = `${Math.round(currentZoom * 100)}%`;
  }
}

function hideActiveSpotlight() {
  const spotlight = document.getElementById('active-speaker-spotlight');
  if (spotlight) spotlight.style.display = 'none';
}

// Attach Mouse Drag Panning & Mouse Wheel Zoom listeners
document.addEventListener('DOMContentLoaded', () => {
  const viewport = document.querySelector('.office-viewport');
  if (!viewport) return;

  viewport.addEventListener('mousedown', (e) => {
    if (selectedMode !== 'meeting') return;
    // Don't trigger canvas panning if user clicks interactive HUD buttons/controls
    if (e.target.closest('.zoom-controls-bar') || e.target.closest('.drawer-toggle-btn') || e.target.closest('.active-speaker-spotlight') || e.target.closest('.swarm-drawer') || e.target.closest('.spotlight-close-btn')) {
      return;
    }
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    viewport.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyViewportTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      viewport.style.cursor = 'grab';
    }
  });

  viewport.addEventListener('wheel', (e) => {
    if (selectedMode === 'meeting') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        zoomViewport(delta);
      }
    }
  }, { passive: false });
});

// LIVE METRICS DASHBOARD UPDATER
function updateDashboardMetrics(data) {
  const wsLayout = document.getElementById('workspace-layout');
  const bar = document.getElementById('metrics-dashboard-bar');
  if (bar && wsLayout && wsLayout.style.display !== 'none') {
    bar.style.display = 'grid';
  }

  if (data.cost) {
    const elCost = document.getElementById('val-net-cost');
    const elSavings = document.getElementById('val-spot-savings');
    if (elCost) elCost.textContent = data.cost.formatted_monthly || '$0.00';
    if (elSavings) elSavings.textContent = `Spot Savings: ${data.cost.formatted_spot_savings || '$0.00'}`;
  }

  if (data.security) {
    const elRisk = document.getElementById('val-sec-risk');
    const elStatus = document.getElementById('val-sec-status');
    if (elRisk) elRisk.textContent = `Score ${data.security.risk_score || 0}/10`;
    if (elStatus) elStatus.textContent = `Zero-Trust: ${data.security.zero_trust_compliance_pct || 0}% (${data.security.status || 'Checking'})`;
  }

  if (data.sla) {
    const elSla = document.getElementById('val-sla-target');
    const elRto = document.getElementById('val-sla-rto');
    if (elSla) elSla.textContent = `${data.sla.formatted_sla || '99.9%'} Uptime`;
    if (elRto) elRto.textContent = `RTO: ${data.sla.rto || '< 15m'} | RPO: ${data.sla.rpo || '< 5m'}`;
  }
}

// EXECUTIVE INTERJECTION OVERRIDE HANDLERS
function toggleDirectiveModal() {
  const modal = document.getElementById('directive-modal');
  if (!modal) return;
  const isHidden = modal.style.display === 'none' || !modal.style.display;
  modal.style.display = isHidden ? 'flex' : 'none';
}

function sendExecutiveDirective() {
  const input = document.getElementById('directive-text-input');
  if (!input) return;
  const directive = input.value.strip ? input.value.strip() : input.value.trim();
  if (!directive) {
    alert('Please enter an executive directive before applying.');
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      action: 'interject',
      directive: directive
    }));
    input.value = '';
    toggleDirectiveModal();
  } else {
    alert('WebSocket connection is not active.');
  }
}

function clearExecutiveDirectives() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      action: 'clear_directives'
    }));
  }
}

function handleDirectiveApplied(data) {
  const countEl = document.getElementById('val-directives-count');
  const chipsEl = document.getElementById('directives-chips');

  const directives = data.directives || [];
  if (countEl) countEl.textContent = `${directives.length} Active`;

  if (chipsEl) {
    if (directives.length === 0) {
      chipsEl.innerHTML = '<span style="font-size: 12px; color: var(--text-tertiary); font-style: italic;">No active directives. Debate running standard parameters.</span>';
    } else {
      chipsEl.innerHTML = directives.map((d, i) => `
        <div style="background: #fffbe6; border: 1px solid #ffe58f; padding: 6px 10px; border-radius: 6px; font-size: 12px; color: #d48806; font-weight: 500;">
          ⚡ <strong>Directive #${i+1}:</strong> ${d}
        </div>
      `).join('');
    }
  }

  if (data.latest) {
    // Show a high-visibility toast banner on screen
    const banner = document.getElementById('status-banner');
    const message = document.getElementById('status-message');
    if (banner && message) {
      banner.style.display = 'flex';
      message.textContent = `⚡ Live Executive Override Applied: '${data.latest}'`;
    }
  }
}

// EXECUTIVE CONSTRAINT RELAXATION PETITION HANDLERS (HUMAN-IN-THE-LOOP)
function handleRelaxationRequested(data) {
  const modal = document.getElementById('relaxation-modal');
  if (modal) {
    const qElem = document.getElementById('relaxation-question-text');
    if (qElem && data.question) qElem.textContent = data.question;

    const currElem = document.getElementById('relaxation-curr-val');
    if (currElem && data.current_value) currElem.textContent = data.current_value;

    const reqElem = document.getElementById('relaxation-req-val');
    if (reqElem && data.requested_value) reqElem.textContent = data.requested_value;

    const reasonElem = document.getElementById('relaxation-reason-text');
    if (reasonElem && data.reason) reasonElem.textContent = data.reason;

    const inputPct = document.getElementById('input-relaxation-pct');
    if (inputPct && data.requested_percent) inputPct.value = 7;

    modal.style.display = 'flex';
  }

  // ALSO render high-visibility interactive card directly into the Chat View feed
  const feed = document.getElementById('transcript-feed');
  if (feed) {
    // Remove any previous inline relaxation card
    const oldCard = document.getElementById('inline-relaxation-decision-card');
    if (oldCard) oldCard.remove();

    const emptyState = feed.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const card = document.createElement('div');
    card.className = 'speech-card escalation interactive-relaxation-chat-card';
    card.id = 'inline-relaxation-decision-card';
    card.style.border = '2px solid #ea4335';
    card.style.background = '#fff8f7';
    card.style.borderRadius = '12px';
    card.style.padding = '16px';
    card.style.margin = '16px 0';
    card.style.boxShadow = '0 8px 24px rgba(234, 67, 53, 0.15)';

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed rgba(234, 67, 53, 0.3); padding-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">⚖️</span>
          <strong style="color: #c5221f; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Executive Adjudication Required</strong>
        </div>
        <span class="status-badge-live pulse-red" style="font-size: 11px; padding: 2px 8px;">SWARM PAUSED AWAITING YOU</span>
      </div>

      <p style="font-size: 13.5px; line-height: 1.5; color: #202124; margin: 0 0 14px 0;">
        <strong>Head of PMO Question:</strong> ${data.question || 'Can we seek a relaxation on project constraints?'}<br>
        <span style="display: inline-block; margin-top: 4px; font-size: 12px; color: #5f6368;">
          Current: <strong>${data.current_value || 'Baseline'}</strong> ➔ Requested: <strong style="color: #ea4335;">${data.requested_value || '+10% Relief'}</strong>
        </span>
      </p>

      <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #5f6368; margin-bottom: 8px;">
        Select Your Executive Ruling:
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <button type="button" onclick="applyInlineRelaxationDecision(10, 'Approved requested 10% increase. Deliver without delay.')" style="padding: 10px; font-size: 12px; font-weight: 600; border: 1px solid #dadce0; border-radius: 8px; background: white; cursor: pointer; text-align: left;">
          🟢 Grant 10% (Full Request)
        </button>
        <button type="button" onclick="applyInlineRelaxationDecision(7, 'We got 7% hike deal with it')" style="padding: 10px; font-size: 12px; font-weight: 700; border: 1.5px solid #1a73e8; border-radius: 8px; background: #e8f0fe; color: #1a73e8; cursor: pointer; text-align: left;">
          ★ Grant 7% ("Deal with it")
        </button>
        <button type="button" onclick="applyInlineRelaxationDecision(5, 'Approved strict 5% compromise. No further exceptions.')" style="padding: 10px; font-size: 12px; font-weight: 600; border: 1px solid #dadce0; border-radius: 8px; background: white; cursor: pointer; text-align: left;">
          🟡 Grant 5% (Partial Compromise)
        </button>
        <button type="button" onclick="applyInlineRelaxationDecision(0, 'Strictly rejected. Existing constraints are absolute. Deal with it.')" style="padding: 10px; font-size: 12px; font-weight: 600; border: 1px solid rgba(234, 67, 53, 0.4); border-radius: 8px; background: #fce8e6; color: #c5221f; cursor: pointer; text-align: left;">
          🛑 Deny (0% - Keep Baseline Strict)
        </button>
      </div>

      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 14px; background: white; border: 1px solid #dadce0; border-radius: 8px; padding: 8px 12px;">
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="font-size: 11px; font-weight: 700; color: #5f6368;">HIKE:</span>
          <input type="number" id="inline-relaxation-pct" value="7" min="0" max="50" step="0.5" style="width: 52px; font-size: 15px; font-weight: 700; border: 1px solid #dadce0; border-radius: 6px; padding: 4px 6px; text-align: center;">
          <span style="font-weight: 700; font-size: 13px; color: #5f6368;">%</span>
        </div>
        <div style="flex: 1;">
          <input type="text" id="inline-relaxation-note" value="We got 7% hike deal with it" placeholder="Directive note to agents..." style="width: 100%; font-size: 12.5px; border: 1px solid #dadce0; border-radius: 6px; padding: 5px 10px;">
        </div>
      </div>

      <button type="button" class="g-button primary" onclick="submitInlineRelaxationDecision()" style="width: 100%; background: linear-gradient(135deg, #ea4335, #c5221f); border-color: #ea4335; color: white; font-weight: 700; font-size: 13px; padding: 11px 20px; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(234, 67, 53, 0.35); text-align: center;">
        Issue Binding Ruling to Head of PMO ⚡
      </button>
    `;

    feed.appendChild(card);
    feed.scrollTop = feed.scrollHeight;
  }

  showToastNotification('🚨 ACTION REQUIRED: Head of PMO is requesting constraint relaxation!', 'warning');
}

function applyInlineRelaxationDecision(percent, note) {
  const inlinePct = document.getElementById('inline-relaxation-pct');
  const inlineNote = document.getElementById('inline-relaxation-note');
  if (inlinePct) inlinePct.value = percent;
  if (inlineNote) inlineNote.value = note;

  // Also sync modal
  setRelaxationDecision(percent, note);
}

function submitInlineRelaxationDecision() {
  const inlinePct = document.getElementById('inline-relaxation-pct');
  const inlineNote = document.getElementById('inline-relaxation-note');
  const pct = inlinePct ? parseFloat(inlinePct.value) || 0 : 7.0;
  const note = inlineNote ? inlineNote.value.trim() : 'We got 7% hike deal with it';

  dispatchRelaxationDecision(pct, note);
}

function setRelaxationDecision(percent, note) {
  const inputPct = document.getElementById('input-relaxation-pct');
  const inputNote = document.getElementById('input-relaxation-note');
  if (inputPct) inputPct.value = percent;
  if (inputNote) inputNote.value = note;

  // Sync inline
  const inlinePct = document.getElementById('inline-relaxation-pct');
  const inlineNote = document.getElementById('inline-relaxation-note');
  if (inlinePct) inlinePct.value = percent;
  if (inlineNote) inlineNote.value = note;
}

function submitRelaxationDecision() {
  const inputPct = document.getElementById('input-relaxation-pct');
  const inputNote = document.getElementById('input-relaxation-note');
  const pct = inputPct ? parseFloat(inputPct.value) || 0 : 7.0;
  const note = inputNote ? inputNote.value.trim() : 'We got 7% hike deal with it';

  dispatchRelaxationDecision(pct, note);
}

function dispatchRelaxationDecision(pct, note) {
  const modal = document.getElementById('relaxation-modal');
  const inlineCard = document.getElementById('inline-relaxation-decision-card');

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      action: 'resolve_relaxation',
      approved_percent: pct,
      custom_note: note
    }));
  } else {
    fetch('/api/resolve_relaxation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_percent: pct, custom_note: note })
    });
  }

  if (modal) modal.style.display = 'none';
  if (inlineCard) {
    inlineCard.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: #137333; font-weight: 700; font-size: 13.5px;">
        <span class="material-icons-outlined" style="font-size: 20px;">check_circle</span>
        Executive Ruling Issued: ${pct}% Budget Hike Approved (${note})
      </div>
    `;
    inlineCard.style.borderColor = '#34a853';
    inlineCard.style.background = '#e6f4ea';
  }

  showToastNotification(`⚖️ Ruling Dispatched: Granted ${pct}% relaxation to Swarm.`, 'success');
}

function handleRelaxationResolved(data) {
  const modal = document.getElementById('relaxation-modal');
  if (modal) modal.style.display = 'none';
  const inlineCard = document.getElementById('inline-relaxation-decision-card');
  if (inlineCard) {
    inlineCard.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: #137333; font-weight: 700; font-size: 13.5px;">
        <span class="material-icons-outlined" style="font-size: 20px;">check_circle</span>
        Executive Ruling Applied: ${data.custom_note || 'Approved ' + data.approved_percent + '%'}
      </div>
    `;
    inlineCard.style.borderColor = '#34a853';
    inlineCard.style.background = '#e6f4ea';
  }
  showToastNotification(`✅ Executive Ruling Active: ${data.custom_note || 'Approved ' + data.approved_percent + '%'}`, 'info');
}

// ========================================================
// AUTONOMOUS AGENTIC CODEBASE & LIVE TERMINAL CONTROLLERS
// ========================================================
let currentRepoSlug = 'autonomous_pmo_solution';
let currentRepoFiles = [];
let activeRepoFilePath = 'README.md';
let activeRepoFileContent = '';

function openRepoDrawer() {
  const drawer = document.getElementById('swarm-drawer');
  if (drawer && !drawer.classList.contains('open')) {
    drawer.classList.add('open');
  }
  switchDrawerTab('repo');
}

function switchRightTab(tab) {
  const btnAdr = document.getElementById('btn-right-adr');
  const btnCode = document.getElementById('btn-right-code');
  const bodyAdr = document.getElementById('deliverable-body');
  const bodyCode = document.getElementById('deliverable-code-body');

  if (tab === 'adr') {
    if (btnAdr) btnAdr.classList.add('active');
    if (btnCode) btnCode.classList.remove('active');
    if (bodyAdr) bodyAdr.style.display = 'block';
    if (bodyCode) bodyCode.style.display = 'none';
  } else {
    if (btnAdr) btnAdr.classList.remove('active');
    if (btnCode) btnCode.classList.add('active');
    if (bodyAdr) bodyAdr.style.display = 'none';
    if (bodyCode) bodyCode.style.display = 'block';
  }
}

function copyCurrentRightDeliverable() {
  const btnCode = document.getElementById('btn-right-code');
  if (btnCode && btnCode.classList.contains('active')) {
    const codeElem = document.getElementById('right-code-content');
    if (codeElem) {
      navigator.clipboard.writeText(codeElem.innerText);
      showToastNotification('📋 Implementation code copied to clipboard!', 'success');
    }
  } else {
    const adrElem = document.getElementById('deliverable-body');
    if (adrElem) {
      navigator.clipboard.writeText(adrElem.innerText);
      showToastNotification('📋 Executive ADR copied to clipboard!', 'success');
    }
  }
}

function handleToolStarted(data) {
  const agentId = data.agent_id;
  const tool = data.tool;
  const args = data.args || {};
  const agent = getAgentMeta(agentId);

  // 1. Show live tool banner on agent hotspot in 3D room
  const card = document.getElementById(`meeting-card-${agentId}`);
  if (card) {
    let toolBanner = card.querySelector('.tool-exec-banner');
    if (!toolBanner) {
      toolBanner = document.createElement('div');
      toolBanner.className = 'tool-exec-banner';
      card.appendChild(toolBanner);
    }
    const argLabel = args.path || args.command || args.query || args.commit_message || '';
    const displayLabel = argLabel ? (argLabel.length > 25 ? argLabel.slice(0, 22) + '...' : argLabel) : '';
    toolBanner.textContent = `🛠️ ${tool}${displayLabel ? ': ' + displayLabel : ''}`;
    toolBanner.style.display = 'block';
  }

  // 2. Append to terminal log
  appendTerminalLine(`⚡ [TOOL INVOKED] ${agent.title} (${agentId}) ➔ ${tool}`, 'term-cmd');
  if (args.command) {
    appendTerminalLine(`$ ${args.command}`, 'term-cmd');
  } else if (args.path) {
    appendTerminalLine(`> writing file: ${args.path}`, 'term-dim');
  } else if (args.query) {
    appendTerminalLine(`? searching: "${args.query}"`, 'term-dim');
  }
}

function handleToolOutput(data) {
  const agentId = data.agent_id;
  const tool = data.tool;
  const res = data.result || {};

  // 1. Dismiss tool banner on card after 3s
  const card = document.getElementById(`meeting-card-${agentId}`);
  if (card) {
    const toolBanner = card.querySelector('.tool-exec-banner');
    if (toolBanner) {
      setTimeout(() => {
        if (toolBanner) toolBanner.style.display = 'none';
      }, 3000);
    }
  }

  // 2. Append output to terminal log
  if (res.action === 'run_command' || tool === 'run_command') {
    const exitCode = res.exit_code;
    const isSuccess = exitCode === 0;
    const out = (res.stdout || '').trim();
    const err = (res.stderr || '').trim();

    if (out) appendTerminalLine(out, isSuccess ? 'term-success' : 'term-dim');
    if (err) appendTerminalLine(err, isSuccess ? 'term-dim' : 'term-error');
    appendTerminalLine(`[Exit Code ${exitCode}] ${isSuccess ? '✅ Command succeeded' : '⚠️ Non-zero exit code'}`, isSuccess ? 'term-success' : 'term-error');
  } else if (res.action === 'write_file' || tool === 'write_file') {
    appendTerminalLine(`✔ Wrote ${res.file_path} (${res.size_bytes} bytes, ${res.line_count} lines)`, 'term-success');
  } else if (res.action === 'git_init' || tool === 'git_init') {
    appendTerminalLine(`📦 Local Git repository initialized & staged files committed.`, 'term-success');
  } else if (res.abstract || res.results) {
    appendTerminalLine(`🔍 Search result: ${res.abstract || (res.results && res.results[0]) || 'Indexed'}`, 'term-dim');
  }
}

function handleRepoFileCreated(data) {
  const repoName = data.repo_name || currentRepoSlug;
  const filePath = data.file_path;
  currentRepoSlug = repoName;

  // Track file
  if (!currentRepoFiles.some(f => f.path === filePath)) {
    currentRepoFiles.push({ path: filePath, size_bytes: data.size_bytes });
  }

  // Update badge count
  const countBadge = document.getElementById('repo-badge-count');
  if (countBadge) {
    countBadge.textContent = `${currentRepoFiles.length} files`;
    countBadge.style.display = 'inline-block';
  }

  const countTag = document.getElementById('repo-file-count-tag');
  if (countTag) countTag.textContent = `${currentRepoFiles.length} files`;

  renderRepoFileTree();

  // Load content of this newly created file
  fetchRepoFileContent(repoName, filePath);
}

function handleRepoStateUpdate(data) {
  if (data.repo_name) currentRepoSlug = data.repo_name;
  if (data.files && Array.isArray(data.files)) currentRepoFiles = data.files;

  // Header updates
  const titleDisplay = document.getElementById('repo-title-display');
  if (titleDisplay) titleDisplay.textContent = `generated_repos/${currentRepoSlug}`;

  const diskPathDisplay = document.getElementById('repo-disk-path-display');
  if (diskPathDisplay && data.abs_path) diskPathDisplay.textContent = data.abs_path;

  const statusBadge = document.getElementById('repo-status-badge');
  if (statusBadge) {
    statusBadge.textContent = `🟢 ${data.phase || data.status || 'Active'}`;
    statusBadge.className = 'status-pill status-ready';
  }

  const testBadge = document.getElementById('repo-test-badge');
  if (testBadge && data.test_status) {
    testBadge.textContent = data.test_status;
    testBadge.className = data.test_status.includes('PASSED') ? 'status-pill status-ready' : 'status-pill status-test';
  }

  const countBadge = document.getElementById('repo-badge-count');
  if (countBadge) {
    countBadge.textContent = `${currentRepoFiles.length} files`;
    countBadge.style.display = 'inline-block';
  }

  const countTag = document.getElementById('repo-file-count-tag');
  if (countTag) countTag.textContent = `${currentRepoFiles.length} files`;

  renderRepoFileTree();

  const defaultFile = currentRepoFiles.find(f => f.path.includes('service') || f.path.includes('core')) || currentRepoFiles[0];
  if (defaultFile) {
    fetchRepoFileContent(currentRepoSlug, defaultFile.path);
  }
}

function renderRepoFileTree() {
  const container = document.getElementById('repo-files-list');
  if (!container) return;

  if (currentRepoFiles.length === 0) {
    container.innerHTML = '<div class="empty-files-placeholder" style="color: #64748b; font-size: 11px; padding: 10px; text-align: center;">No files generated yet. Swarm will write code in Phase 7.</div>';
    return;
  }

  container.innerHTML = currentRepoFiles.map(f => {
    const isAct = f.path === activeRepoFilePath;
    const icon = f.path.endsWith('.py') ? '🐍' : (f.path.endsWith('.md') ? '📝' : (f.path.includes('Dockerfile') ? '🐳' : '📄'));
    return `
      <div class="tree-file-item ${isAct ? 'active' : ''}" onclick="selectRepoFile('${f.path}')">
        <span class="tree-file-icon">${icon}</span>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.path}</span>
      </div>
    `;
  }).join('');
}

async function selectRepoFile(path) {
  activeRepoFilePath = path;
  renderRepoFileTree();
  await fetchRepoFileContent(currentRepoSlug, path);
}

async function fetchRepoFileContent(slug, path) {
  try {
    const res = await fetch(`/api/repos/${slug}/file?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      const data = await res.json();
      activeRepoFileContent = data.content || '';
      activeRepoFilePath = path;

      // Update Drawer Code Viewer
      const fnElem = document.getElementById('repo-active-filename');
      if (fnElem) fnElem.textContent = path;
      const codeElem = document.getElementById('repo-code-content');
      if (codeElem) codeElem.textContent = activeRepoFileContent;

      // Update Right Sidebar Code Deliverable
      const rightFn = document.getElementById('right-code-filename');
      if (rightFn) rightFn.textContent = `${path} (${data.line_count || 0} lines)`;
      const rightCode = document.getElementById('right-code-content');
      if (rightCode) rightCode.textContent = activeRepoFileContent;
    }
  } catch (err) {
    console.warn('Error reading repo file content:', err);
  }
}

function copyActiveRepoFile() {
  if (activeRepoFileContent) {
    navigator.clipboard.writeText(activeRepoFileContent);
    showToastNotification(`📋 Copied ${activeRepoFilePath} to clipboard!`, 'success');
  }
}

function appendTerminalLine(text, styleClass = '') {
  const term = document.getElementById('repo-terminal-body');
  if (!term) return;

  const line = document.createElement('div');
  line.className = `term-line ${styleClass}`;
  line.textContent = text;
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}

function clearTerminalLogs() {
  const term = document.getElementById('repo-terminal-body');
  if (term) {
    term.innerHTML = '<div class="term-line term-system">Terminal console cleared. Ready for next command.</div>';
  }
}

async function runRepoTestsDirectly() {
  appendTerminalLine(`⚡ [MANUAL TEST DISPATCH] Executing: python3 -m unittest discover tests`, 'term-cmd');
  try {
    const res = await fetch(`/api/repos/${currentRepoSlug}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'python3 -m unittest discover -s tests -p "test_*.py"' })
    });
    if (res.ok) {
      const data = await res.json();
      const exitCode = data.exit_code;
      const isSuccess = exitCode === 0;
      if (data.stdout) appendTerminalLine(data.stdout, isSuccess ? 'term-success' : 'term-dim');
      if (data.stderr) appendTerminalLine(data.stderr, isSuccess ? 'term-dim' : 'term-error');
      appendTerminalLine(`[Test Result] Exit Code: ${exitCode} ${isSuccess ? '✅ ALL TESTS GREEN' : '⚠️ FAILURES DETECTED'}`, isSuccess ? 'term-success' : 'term-error');
      showToastNotification(isSuccess ? '✅ Automated unit tests passed!' : '⚠️ Unit tests reported failures. Check terminal output.', isSuccess ? 'success' : 'warning');
    }
  } catch (err) {
    appendTerminalLine(`Error executing test runner: ${err.message}`, 'term-error');
  }
}

function handleEngineeringSquadCommissioned(data) {
  const members = data.members || [];
  const repoName = data.repo_name || 'autonomous_pmo_solution';
  
  showToastNotification(`🚀 [Engineering Squad Commissioned]: ${members.length} engineers hired under SDM leadership to build ${repoName}!`, 'success');

  const statusText = document.getElementById('meeting-status-text');
  if (statusText) {
    statusText.innerHTML = `<span class="status-pulse-dot"></span> 💻 Phase 7: Software Engineering Squad Active (${members.length} Engineers)`;
  }

  // Ensure dynamic engineering section is visible
  const sec = document.getElementById('dyn-eng-squad-section');
  if (sec) sec.style.display = 'block';

  const wrapper = document.getElementById('canvas-zoom-wrapper');
  if (!wrapper) return;

  // Ensure all squad members exist in activeCommissionedHierarchy
  if (!activeCommissionedHierarchy) {
    activeCommissionedHierarchy = { agents: [], specialists: [] };
  }
  if (!activeCommissionedHierarchy.agents) activeCommissionedHierarchy.agents = [];
  if (!activeCommissionedHierarchy.specialists) activeCommissionedHierarchy.specialists = [];

  members.forEach(m => {
    const aid = m.id;
    if (!activeCommissionedHierarchy.agents.includes(aid)) {
      activeCommissionedHierarchy.agents.push(aid);
    }
    if (aid !== 'sdm_lead' && !activeCommissionedHierarchy.specialists.includes(aid)) {
      activeCommissionedHierarchy.specialists.push(aid);
    }

    let card = document.getElementById(`meeting-card-${aid}`);
    const meta = getAgentMeta(aid);
    const avatar = m.avatar || meta.avatar || '💻';
    const title = m.title || meta.title || aid;

    if (!card) {
      card = document.createElement('div');
      card.id = `meeting-card-${aid}`;
      card.className = `desk-hotspot placement-side-left tier3-hotspot dynamic-desk-hotspot eng-squad-hotspot`;
      card.setAttribute('data-agent', aid);
      wrapper.appendChild(card);
    }

    card.style.display = 'flex';
    card.classList.remove('unhired-desk', 'fired-warning');

    const reportingTagHtml = aid === 'sdm_lead' 
      ? '<span class="reporting-tag tag-exec">↳ Head PMO</span>'
      : '<span class="reporting-tag tag-tech" style="background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.3);">↳ SDM</span>';

    // Ensure floating pill exists
    let pill = card.querySelector('.floating-agent-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.className = `floating-agent-pill ${aid === 'sdm_lead' ? 'tier2-pill' : 'tier3-pill'}`;
      card.appendChild(pill);
    }
    pill.innerHTML = `
      <span class="pill-avatar">${avatar}</span>
      <span class="pill-title">${title}</span>
      ${reportingTagHtml}
      <span class="active-dot">● Active</span>
    `;

    // Ensure thinking cloud & speech bubble exist
    if (!card.querySelector('.thinking-cloud')) {
      const think = document.createElement('div');
      think.className = 'thinking-cloud';
      think.id = `think-${aid}`;
      think.style.display = 'none';
      think.innerHTML = `<span class="think-pulse">💭</span><span class="think-text">Engineering Code...</span>`;
      card.appendChild(think);
    }
    if (!card.querySelector('.speech-bubble-popup')) {
      const bubble = document.createElement('div');
      bubble.className = `speech-bubble-popup placement-side-left`;
      bubble.id = `bubble-${aid}`;
      bubble.style.display = 'none';
      bubble.innerHTML = `
        <div class="bubble-header">
          <span class="agent-title-tag">${avatar} ${title}</span>
          <span class="phase-tag" id="phase-${aid}">Phase 7</span>
        </div>
        <div class="bubble-body custom-scrollbar" id="text-${aid}"></div>
      `;
      card.appendChild(bubble);
    }
  });

  // Re-layout office dynamically so ALL agents have distinct non-overlapping workstations
  layoutManagerLedOffice(activeCommissionedHierarchy);

  // Redraw hierarchy reporting lines connecting squad to SDM and SDM to Head of PMO!
  drawHierarchyReportingLines();
  updateActiveOfficeAgentCount();
}
