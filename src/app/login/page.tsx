'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [licenseType, setLicenseType] = useState('');
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('counselor', JSON.stringify(data.counselor));
      router.push('/');
    } else {
      setError(data.detail || '로그인 실패');
    }
  }

  async function handleRegister() {
    setError('');
    if (!email || !password || !name) { setError('필수 항목을 입력하세요'); return; }
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, license_type: licenseType, organization }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('counselor', JSON.stringify(data.counselor));
      router.push('/');
    } else {
      setError(data.detail || '회원가입 실패');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 4, color: 'var(--primary)' }}>🧠 AI 상담 보조 시스템</h1>
        <p style={{ color: 'var(--text-light)', marginBottom: 24, fontSize: '0.9rem' }}>상담사 전용 로그인</p>

        {/* Tab */}
        <div style={{ display: 'flex', marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <button onClick={() => setTab('login')} style={{ flex: 1, padding: '10px', borderRadius: 0, background: tab === 'login' ? 'var(--primary)' : 'white', color: tab === 'login' ? 'white' : 'var(--text)' }}>로그인</button>
          <button onClick={() => setTab('register')} style={{ flex: 1, padding: '10px', borderRadius: 0, background: tab === 'register' ? 'var(--primary)' : 'white', color: tab === 'register' ? 'white' : 'var(--text)' }}>회원가입</button>
        </div>

        {tab === 'login' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input placeholder="이메일" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <input placeholder="비밀번호" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
            <button className="btn-primary" onClick={handleLogin} style={{ marginTop: 8 }}>로그인</button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 8 }}>데모 계정: kim@demo.com / 1234</p>
          </div>
        )}

        {tab === 'register' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input placeholder="이름 *" value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="이메일 *" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <input placeholder="비밀번호 *" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <input placeholder="소속 기관" value={organization} onChange={e => setOrganization(e.target.value)} />
            <input placeholder="자격증 종류" value={licenseType} onChange={e => setLicenseType(e.target.value)} />
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
            <button className="btn-primary" onClick={handleRegister} style={{ marginTop: 8 }}>회원가입</button>
          </div>
        )}
      </div>
    </div>
  );
}
