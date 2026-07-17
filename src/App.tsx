import { useState } from 'react';
import { MemberList } from './components/member/MemberList';
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

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <h1>EZMOO Guild Manager</h1>
          <p>สมาชิกทั้งหมด {members.length} คน</p>
        </div>

        <button
          type="button"
          className="reload-button"
          onClick={() => void reloadMembers()}
          disabled={isLoading}
        >
          {isLoading ? 'กำลังโหลด...' : 'โหลดใหม่'}
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

      <section className="content-panel">
        <h2>Members</h2>

        {isLoading && (
          <p className="status-message">
            กำลังโหลดข้อมูลสมาชิก...
          </p>
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
          <MemberList members={members} mode={mode} />
        )}
      </section>
    </main>
  );
}

export default App;