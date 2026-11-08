---
name: frontend-design
description: >-
  Lead Design Director skill for crafting high-aesthetic, accessible, production-grade
  web interfaces. Prevents generic AI layouts and enforces intentional typography,
  accessible color tokens (WCAG 2.1 AAA), purposeful visual hierarchy, and fluid micro-interactions.
---

# Frontend Design & Interface Architecture Skill

## 1. Core Philosophy: Anti-"AI Slop"
Never generate generic layouts:
- No predictable centered hero with identical 3-card grid and purple/blue gradients.
- Always commit to an explicit visual direction tailored to the problem domain.
- For Healthcare & Accessibility: **Clean Clinical, High Contrast (WCAG AAA), Visual-First & Touch-Friendly**.

## 2. Design System Tokens for Healthcare & Sign Language (SignBridge AI)
- **Palette:**
  - Primary: Deep Teal / Hospital Jade (`#0D9488` / `#0F766E`) - represents care, safety, and precision.
  - Emergency Alert: Vivid Crimson (`#DC2626` / `#EF4444`) with high-contrast badge.
  - Success / Confirmation: Emerald (`#10B981`).
  - Neutral Backgrounds: Slate / Crisp Hospital White (`#F8FAFC`, `#FFFFFF`, `#0F172A`).
- **Typography:**
  - Headings: Inter / Plus Jakarta Sans, bold, clean tracking.
  - Body & Badges: High legibility sans-serif, minimum 16px for kiosk readability.
- **Accessibility (A11y & Deaf/HoH Community):**
  - Minimum touch target: 48x48px.
  - Visual-first confirmation: Colored status pills, clear badge indicators, explicit confirmation banners before submission.
  - Dual-screen awareness: Patient Kiosk Mode vs. Clinician Reception Dashboard.

## 3. Structural Hierarchy
1. **Header:** Identity, live status indicator, Mode Switcher (Kiosk Người bệnh ↔ Dashboard Y bác sĩ).
2. **Main Workspace:**
   - Patient Mode: Split screen with Live Camera / Video Stream on the left, Real-time Gloss + Translation + 2-Way Confirmation on the right.
   - Clinician Mode: Real-time ticket queue, categorized symptom breakdown by specialty, and 1-tap quick doctor response pills.
3. **Emergency Action Bar:** Always accessible, one-tap emergency call with audible/visual pulse.

