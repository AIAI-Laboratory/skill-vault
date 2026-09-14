export const PALETTE_STYLES = `
:host {
  all: initial;
  position: absolute;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: #F0F2F5;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.sv-palette {
  width: 360px;
  max-width: calc(100vw - 32px);
  max-height: 420px;
  background: rgba(20, 22, 27, 0.96);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: svFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes svFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.sv-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.sv-logo-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #FF453A;
  background: rgba(255, 69, 58, 0.12);
  padding: 3px 6px;
  border-radius: 4px;
}

.sv-search-indicator {
  flex: 1;
  font-size: 13px;
  color: #9CA3AF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-search-indicator strong {
  color: #FFFFFF;
}

.sv-list {
  list-style: none;
  overflow-y: auto;
  max-height: 320px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sv-list::-webkit-scrollbar {
  width: 5px;
}

.sv-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.sv-item {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s ease, transform 0.1s ease;
  user-select: none;
}

.sv-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.sv-item.selected {
  background: rgba(255, 69, 58, 0.15);
  border: 1px solid rgba(255, 69, 58, 0.35);
}

.sv-item-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sv-item-name {
  font-size: 13px;
  font-weight: 600;
  color: #F3F4F6;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sv-item.selected .sv-item-name {
  color: #FFFFFF;
}

.sv-fav-star {
  color: #FBBF24;
  font-size: 12px;
}

.sv-shortcut-badge {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #9CA3AF;
  background: rgba(255, 255, 255, 0.07);
  padding: 2px 5px;
  border-radius: 4px;
}

.sv-item.selected .sv-shortcut-badge {
  color: #FF8A80;
  background: rgba(255, 69, 58, 0.2);
}

.sv-item-desc {
  font-size: 11.5px;
  color: #9CA3AF;
  margin-top: 3px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sv-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 5px;
}

.sv-tag {
  font-size: 10px;
  color: #6B7280;
  background: rgba(255, 255, 255, 0.04);
  padding: 1px 5px;
  border-radius: 3px;
}

.sv-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  font-size: 11px;
  color: #6B7280;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.sv-hints {
  display: flex;
  gap: 8px;
}

.sv-kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  color: #D1D5DB;
}

.sv-empty {
  padding: 24px 16px;
  text-align: center;
  color: #9CA3AF;
  font-size: 12.5px;
}

.sv-empty-hint {
  font-size: 11px;
  color: #6B7280;
  margin-top: 4px;
}
`;
