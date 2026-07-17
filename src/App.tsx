import { useState } from 'react';
import { MemberPanel } from './components/member/MemberPanel';
import { PartyBoard } from './components/party/PartyBoard';
import { useMembers } from './hooks/useMembers';
import type { PartyMode } from './types/member';

function App() {
  const [mode, setMode] =
    useState<PartyMode>('guildLeague');

  const {
    members,
    isLoading,
    errorMessage,
    reloadMembers,
  } = useMembers();

  const modeLabel =
    mode === 'guildLeague'
      ? 'Guild League'
      : 'Overrun';

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">EZ</div>

          <div>
            <h1>EZMOO Guild Manager</h1>
            <p>Party management system</p>
          </div>
        </div>

        <button
          type="button"
          className="reload-button"
          onClick={() => void reloadMembers()}
          disabled={isLoading}
        >
          {isLoading ? 'กำลังโหลด...' : 'โหลดข้อมูลใหม่'}
        </button>
      </header>

      <nav className="mode-selector">
        <button
          type="button"
          className={
            mode === 'guildLeague' ? 'active' : ''
          }
          onClick={() => setMode('guildLeague')}
        >
          Guild League
        </button>

        <button
          type="button"
          className={mode === 'overrun' ? 'active' : ''}
          onClick={() => setMode('overrun')}
        >
          Overrun
        </button>
      </nav>

      {isLoading && (
        <div className="status-card">
          กำลังโหลดข้อมูลสมาชิก...
        </div>
      )}

      {errorMessage && (
        <div className="error-message">
          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={() => void reloadMembers()}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {!isLoading && !errorMessage && (
        <main className="workspace">
          <PartyBoard modeLabel={modeLabel} />

          <MemberPanel
            members={members}
            mode={mode}
          />
        </main>
      )}
    </div>
  );
}

export default App;