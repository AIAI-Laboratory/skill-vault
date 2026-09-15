import React, { useRef } from 'react';
import { Download, Upload, ShieldCheck, Sparkles } from 'lucide-react';
import { Skill, SkillVaultSettings } from '../../domain/types';

interface SettingsProps {
  settings: SkillVaultSettings;
  skills: Skill[];
  onUpdateSettings: (patch: Partial<SkillVaultSettings>) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  skills,
  onUpdateSettings,
  onExport,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalUsages = skills.reduce((acc, s) => acc + (s.usage?.count || 0), 0);
  const totalFavorites = skills.filter((s) => s.favorite).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stats Section */}
      <div className="settings-section">
        <div className="section-title">
          <Sparkles size={16} color="#FF453A" /> Vault Statistics
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
            textAlign: 'center',
          }}
        >
          <div
            style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 6px', borderRadius: 8 }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{skills.length}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Total Skills</div>
          </div>
          <div
            style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 6px', borderRadius: 8 }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FBBF24' }}>{totalFavorites}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Favorites</div>
          </div>
          <div
            style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 6px', borderRadius: 8 }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981' }}>{totalUsages}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Injections</div>
          </div>
        </div>
      </div>

      {/* AI Providers */}
      <div className="settings-section">
        <div className="section-title">Supported AI Chat Providers</div>
        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-name">ChatGPT (chatgpt.com)</span>
            <span className="setting-desc">Enable in-chat /skill command palette</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.enableChatGPT}
              onChange={(e) => onUpdateSettings({ enableChatGPT: e.target.checked })}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-name">Claude (claude.ai)</span>
            <span className="setting-desc">Enable ProseMirror slash detection</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.enableClaude}
              onChange={(e) => onUpdateSettings({ enableClaude: e.target.checked })}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-name">Google Gemini (gemini.google.com)</span>
            <span className="setting-desc">Enable rich-textarea slash command</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.enableGemini}
              onChange={(e) => onUpdateSettings({ enableGemini: e.target.checked })}
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      {/* Preferences */}
      <div className="settings-section">
        <div className="section-title">Preferences</div>
        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-name">Show Favorites First</span>
            <span className="setting-desc">Prioritize starred skills in /skill palette</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.showFavoritesFirst}
              onChange={(e) => onUpdateSettings({ showFavoritesFirst: e.target.checked })}
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="settings-section">
        <div className="section-title">Backup & Restore</div>
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>
          Export your skills as a JSON file or restore from an existing backup.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="btn-secondary" onClick={onExport} style={{ flex: 1 }}>
            <Download size={14} /> Export Backup
          </button>
          <button
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            style={{ flex: 1 }}
          >
            <Upload size={14} /> Import Backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Privacy Guarantee */}
      <div
        className="settings-section"
        style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
      >
        <div className="section-title" style={{ color: '#34D399' }}>
          <ShieldCheck size={16} /> Local-First & Zero Analytics
        </div>
        <p style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.4 }}>
          Your prompts and conversations never leave your device. Skill Vault operates 100% locally
          via Chrome storage without remote tracking, cloud accounts, or third-party telemetry.
        </p>
      </div>
    </div>
  );
};
