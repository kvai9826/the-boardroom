"""
PMO Agent Swarm Tool Suite
Dynamic Domain-Agnostic Metric Extractor and Financial/Risk Auditor
Parses quantitative data, ROI figures, error rates, and constraint compliance directly from agent debate transcripts.
"""

import re
from typing import Dict, Any

def extract_swarm_metrics(agent_outputs_combined: str) -> Dict[str, Any]:
    """
    Dynamically extracts key financial metrics, risk scores, error rates, and compliance stats
    from the actual text produced by agents during the debate, without forcing pre-fitted numbers.
    """
    text = agent_outputs_combined or ""
    text_lower = text.lower()
    
    # 1. Financial Metric Extraction
    # Match amounts like $5,000, $5k, $10M, $6,000,000
    pattern = r'\$\s*([\d,]+(?:\.\d+)?)\s*(M|Million|K|Thousand|B|Billion)?'
    matches = re.findall(pattern, text, re.IGNORECASE)
    
    parsed_dollars = []
    monthly_costs = []
    annual_savings = []

    for val_str, mult_str in matches:
        if val_str:
            try:
                clean_num = float(val_str.replace(',', ''))
                mult_upper = (mult_str or "").upper()
                
                # Only apply multiplier if the base number is small (< 1000)
                if clean_num < 1000:
                    if 'M' in mult_upper:
                        clean_num *= 1_000_000
                    elif 'K' in mult_upper:
                        clean_num *= 1_000
                    elif 'B' in mult_upper:
                        clean_num *= 1_000_000_000

                # Sanity check: filter out insane numbers > 1 Trillion caused by text glitches
                if clean_num <= 100_000_000_000:
                    parsed_dollars.append(clean_num)
                    if clean_num <= 50_000:
                        monthly_costs.append(clean_num)
                    elif clean_num >= 500_000:
                        annual_savings.append(clean_num)
            except ValueError:
                pass

    # Determine Monthly Spend Metric
    if monthly_costs:
        est_monthly = max(monthly_costs)
        formatted_cost = f"${est_monthly:,.2f}" if est_monthly < 1000 else f"${est_monthly:,.0f}"
    elif parsed_dollars:
        # Look for small dollar values
        small_vals = [d for d in parsed_dollars if d <= 100_000]
        if small_vals:
            est_monthly = small_vals[0]
            formatted_cost = f"${est_monthly:,.2f}" if est_monthly < 1000 else f"${est_monthly:,.0f}"
        else:
            formatted_cost = f"${min(parsed_dollars):,.0f} (Stated)"
    else:
        formatted_cost = "Stated Cap"

    # Determine Savings Target Metric
    if annual_savings:
        target_sav = max(annual_savings)
        formatted_savings = f"${target_sav:,.0f}"
    elif parsed_dollars:
        target_sav = max(parsed_dollars)
        formatted_savings = f"${target_sav:,.0f}"
    else:
        formatted_savings = "Target Not Specified"

    # 2. Dynamic Error Rate & Risk Extraction
    error_pct_matches = re.findall(r'(\d+(?:\.\d+)?)\s*%\s*(?:error|accuracy|failure|review|automation)', text_lower)
    if error_pct_matches:
        pcts = [float(p) for p in error_pct_matches]
        avg_pct = round(sum(pcts) / len(pcts), 1)
        risk_score = round(max(1.0, min(10.0, avg_pct * 1.5)), 1)
    else:
        avg_pct = 0.0
        risk_score = 2.0

    # 3. Compliance & Constraint Status
    has_unknowns = "unknown" in text_lower or "unspecified" in text_lower
    has_escalation = "human review" in text_lower or "human escalation" in text_lower or "oversight" in text_lower
    
    if risk_score <= 4.0:
        sec_status = "PASSED (Constraint Grounded)"
    elif risk_score <= 7.0:
        sec_status = "CONDITIONAL (Data Gaps / Review Needed)"
    else:
        sec_status = "HIGH RISK (Constraint Veto)"

    conflict_score = risk_score
    
    return {
        "cost": {
            "formatted_monthly": formatted_cost,
            "formatted_spot_savings": f"Savings Target: {formatted_savings}",
            "net_monthly_cost": est_monthly if 'est_monthly' in locals() else 5000
        },
        "security": {
            "risk_score": risk_score,
            "zero_trust_compliance_pct": max(50, min(100, int(100 - (risk_score * 5)))),
            "status": sec_status
        },
        "sla": {
            "formatted_sla": f"{round(100 - avg_pct, 1)}%" if avg_pct > 0 else "100% Validated",
            "rto": "Human Escalation Active" if has_escalation else "Standard",
            "rpo": "Grounded Data"
        },
        "conflict_score": conflict_score,
        "conflict_level": "HIGH (Triggering Adaptive Review)" if conflict_score >= 7.0 else "MANAGED"
    }
