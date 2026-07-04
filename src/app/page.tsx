'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DeleteModal from './components/DeleteModal';

interface Client {
  id: number; name: string; age: number | null;
  gender: string | null; presenting_issue: string;
  latest_risk_level?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', age: '', gender: '', presenting_issue: '' });
  const [counselor, setCounselor] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const c = localStorage.getItem('counselor');
    if (c) setCounselor(JSON.parse(c));
  }, []);

  useEffect(() => { if (counselor) fetchClients(); }, [search, counselor]);

  function getAuthHeader() {
    return { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
  }

  function fetchClients() {
    fetch(`/api/clients?search=${search}`, { headers: getAuthHeader() })
      .then(r => { if (r.status === 401) { router.push('/login'); return []; } return r.json(); })
      .then(data => { if (data) setClients(data); }).catch(() => {});
  }

  async function createClient() {
    if (!form.name.trim()) return;
    await fetch('/api/clients', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ ...form, age: form.age ? parseInt(form.age) : null }),
    });
    setShowForm(false);
    setForm({ name: '', age: '', gender: '', presenting_issue: '' });
    fetchClients();
  }

  async function deleteClient(clientId: number, clientName: string) {
    setDeleteTarget({ id: clientId, name: clientName });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/clients/${deleteTarget.id}`, { method: 'DELETE', headers: getAuthHeader() });
    setDeleteTarget(null);
    fetchClients();
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: 'var(--sidebar-w)', background: '#1a2233', color: 'white', padding: '24px 16px', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'fixed', top: 0, left: 0, height: '100vh' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 24 }}>🧠 AI 상담 보조</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <a href="/" style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: 'white', textDecoration: 'none', fontSize: '0.9rem' }}>📋 내담자 목록</a>
          </nav>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
          {counselor && <p style={{ fontSize: '0.85rem', marginBottom: 8 }}>👤 {counselor.name}</p>}
          <button onClick={() => { localStorage.clear(); router.push('/login'); }} style={{ width: '100%', padding: '8px', fontSize: '0.8rem', background: 'rgba(255,0,0,0.2)', color: '#ff8a80', borderRadius: 6 }}>로그아웃</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: 32, marginLeft: 'var(--sidebar-w)', minHeight: '100vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.5rem' }}>내담자 관리</h1>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ 새 내담자</button>
        </div>

        {/* Search */}
        <input placeholder="이름으로 검색..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 16, maxWidth: 300 }} />

        {/* New client form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>새 내담자 등록</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <input placeholder="이름 *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <input placeholder="나이" type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})} />
              <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                <option value="">성별</option>
                <option value="M">남</option>
                <option value="F">여</option>
              </select>
            </div>
            <input placeholder="주요 호소 문제" value={form.presenting_issue} onChange={e => setForm({...form, presenting_issue: e.target.value})}
              style={{ marginBottom: 12 }} />
            <button className="btn-primary" onClick={createClient}>등록</button>
          </div>
        )}

        {/* Client List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clients.map(c => (
            <div key={c.id} className="card"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div onClick={() => router.push(`/client/${c.id}`)} style={{ cursor: 'pointer', flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>{c.name}</span>
                <span style={{ marginLeft: 8, fontSize: '0.85rem', color: 'var(--text-light)' }}>
                  {c.age && `${c.age}세`} {c.gender === 'M' ? '남' : c.gender === 'F' ? '여' : ''}
                </span>
                {c.latest_risk_level === 'crisis' && <span style={{ marginLeft: 8, fontSize: '0.7rem', background: '#dc2626', color: 'white', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>🚨 위기</span>}
                {c.latest_risk_level === 'warning' && <span style={{ marginLeft: 8, fontSize: '0.7rem', background: '#f59e0b', color: 'white', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>⚠️ 주의</span>}
                {c.presenting_issue && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: 4 }}>{c.presenting_issue}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <button onClick={(e) => { e.stopPropagation(); deleteClient(c.id, c.name); }}
                  style={{ padding: '6px 10px', fontSize: '0.75rem', background: '#fce8e6', color: 'var(--danger)', borderRadius: 6 }}>삭제</button>
                <span onClick={() => router.push(`/client/${c.id}`)} style={{ color: 'var(--text-light)', fontSize: '1.2rem', cursor: 'pointer' }}>→</span>
              </div>
            </div>
          ))}
          {clients.length === 0 && (
            <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>등록된 내담자가 없습니다. 새 내담자를 추가해주세요.</p>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={!!deleteTarget}
        title="내담자 삭제"
        itemName={deleteTarget?.name || ''}
        description="이 내담자에 연결된 모든 상담 회차 기록, AI 분석 결과, 감정 점수 데이터가 영구적으로 삭제됩니다."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
