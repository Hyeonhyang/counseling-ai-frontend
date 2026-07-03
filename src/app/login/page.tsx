'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LICENSE_CATEGORIES = [
  {
    category: '보건복지부 (의료 및 정신보건)',
    items: ['정신건강임상심리사 1급', '정신건강임상심리사 2급', '정신건강전문간호사', '정신건강사회복지사 1급', '정신건강사회복지사 2급', '발달재활서비스 제공인력'],
  },
  {
    category: '여성가족부 (청소년 및 가족)',
    items: ['청소년상담사 1급', '청소년상담사 2급', '청소년상담사 3급'],
  },
  {
    category: '고용노동부 / 한국산업인력공단',
    items: ['임상심리사 1급', '임상심리사 2급', '직업상담사 1급', '직업상담사 2급'],
  },
  {
    category: '교육부 (학교 상담)',
    items: ['전문상담교사 1급', '전문상담교사 2급'],
  },
  {
    category: '공인 학회 (심리·정신치료)',
    items: ['상담심리사 1급 (한상심)', '상담심리사 2급 (한상심)', '임상심리전문가 (한임심)', '전문상담사 1급 (한상학)', '전문상담사 2급 (한상학)', '정신분석치료 전문가'],
  },
  {
    category: '특수 매체 및 대안 치료',
    items: ['부부및가족상담전문가 1급', '부부및가족상담사 2급', '미술치료전문가', '미술심리상담사 1급', '미술심리상담사 2급', '놀이치료전문가', '놀이치료사', '음악치료전문가', '음악심리상담사 1급', '독서치료전문가', '인지행동치료전문가', '무용동작치료전문가'],
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [error, setError] = useState('');

  function toggleLicense(license: string) {
    setSelectedLicenses(prev =>
      prev.includes(license) ? prev.filter(l => l !== license) : [...prev, license]
    );
  }

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
      body: JSON.stringify({
        email, password, name,
        license_type: selectedLicenses.join(', '),
        organization,
      }),
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
      <div className="card" style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
            <input placeholder="이름 *" value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="이메일 *" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <input placeholder="비밀번호 *" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <input placeholder="소속 기관" value={organization} onChange={e => setOrganization(e.target.value)} />

            {/* 자격증 선택 */}
            <div>
              <button className="btn-outline" onClick={() => setShowLicenseModal(!showLicenseModal)}
                style={{ width: '100%', textAlign: 'left', padding: '10px 14px' }}>
                {selectedLicenses.length > 0
                  ? `✓ ${selectedLicenses.length}개 자격증 선택됨`
                  : '자격증 선택 (클릭하여 펼치기)'}
              </button>

              {/* 선택된 자격증 칩 */}
              {selectedLicenses.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {selectedLicenses.map(l => (
                    <span key={l} className="chip">
                      {l}
                      <button onClick={() => toggleLicense(l)}>×</button>
                    </span>
                  ))}
                </div>
              )}

              {/* 자격증 목록 (펼침) */}
              {showLicenseModal && (
                <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 300, overflow: 'auto', padding: 12, background: '#fafafa' }}>
                  {LICENSE_CATEGORIES.map(cat => (
                    <div key={cat.category} style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>{cat.category}</p>
                      {cat.items.map(item => (
                        <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={selectedLicenses.includes(item)} onChange={() => toggleLicense(item)} />
                          {item}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
            <button className="btn-primary" onClick={handleRegister} style={{ marginTop: 8 }}>회원가입</button>
          </div>
        )}
      </div>
    </div>
  );
}
