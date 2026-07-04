'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface SessionData {
  id: number; session_number: number; raw_text: string;
  depression_score: number; anxiety_score: number; anger_score: number; self_esteem_score: number;
  key_persons: string; defense_mechanisms: string; ai_summary: string; technique_used: string;
  risk_level: string; risk_keywords: string;
  soap_subjective: string; soap_objective: string; soap_assessment: string; soap_plan: string;
  session_date: string;
}

interface ClientInfo { id: number; name: string; age: number | null; gender: string | null; presenting_issue: string; }

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [tab, setTab] = useState<'timeline' | 'new' | 'compare' | 'rag' | 'edit'>('timeline');
  const [newText, setNewText] = useState('');
  const [newNumber, setNewNumber] = useState(1);
  const [newTechnique, setNewTechnique] = useState('');
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseResult, setParseResult] = useState<any>(null);
  const [selectedSessions, setSelectedSessions] = useState<number[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [ragResult, setRagResult] = useState<any>(null);
  const [editSession, setEditSession] = useState<SessionData | null>(null);
  const [editText, setEditText] = useState('');
  const [editTechnique, setEditTechnique] = useState('');
  const [editNumber, setEditNumber] = useState(1);
  const [editScores, setEditScores] = useState({ depression_score: 0, anxiety_score: 0, anger_score: 0, self_esteem_score: 0 });
  const [editSoap, setEditSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [editParseResult, setEditParseResult] = useState<any>(null);
  const [soapText, setSoapText] = useState('');
  const [soapResult, setSoapResult] = useState<any>(null);
  const [soapLoading, setSoapLoading] = useState(false);

  function authHeaders(): Record<string, string> {
    return { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' };
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetch(`/api/clients/${clientId}`, { headers: authHeaders() }).then(r => r.json()).then(setClient).catch(() => {});
    fetchSessions();
  }, [clientId]);

  useEffect(() => {
    if (editSession) {
      setEditText(editSession.raw_text);
      setEditTechnique(editSession.technique_used);
      setEditNumber(editSession.session_number);
      setEditScores({
        depression_score: editSession.depression_score,
        anxiety_score: editSession.anxiety_score,
        anger_score: editSession.anger_score,
        self_esteem_score: editSession.self_esteem_score,
      });
      setEditSoap({
        subjective: (editSession as any).soap_subjective || '',
        objective: (editSession as any).soap_objective || '',
        assessment: (editSession as any).soap_assessment || '',
        plan: (editSession as any).soap_plan || '',
      });
    }
  }, [editSession]);

  function fetchSessions() {
    fetch(`/api/sessions/client/${clientId}`, { headers: authHeaders() }).then(r => r.json()).then(data => {
      setSessions(data);
      if (data.length > 0) setNewNumber(data[data.length - 1].session_number + 1);
    }).catch(() => {});
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await transcribeAudio(blob, 'recording.webm');
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch {
      alert('마이크 권한이 필요합니다.');
    }
  }

  function stopRecording() {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
      setMediaRecorder(null);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await transcribeAudio(file, file.name);
  }

  async function transcribeAudio(file: Blob, filename: string) {
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', file, filename);
      const res = await fetch('/api/stt/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.text) {
        setNewText(prev => prev ? prev + '\n\n' + data.text : data.text);
      } else {
        alert('변환 실패: ' + (data.detail || ''));
      }
    } catch { alert('음성 변환 중 오류 발생'); }
    setTranscribing(false);
  }

  async function submitSession() {
    if (!newText.trim()) return;
    setParsing(true);
    try {
      // AI 분석 + SOAP 동시 요청
      const [parseRes, soapRes] = await Promise.all([
        fetch('/api/sessions/parse-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: newText }),
        }),
        fetch('/api/sessions/soap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: newText }),
        }),
      ]);
      const parsed = await parseRes.json();
      const soap = await soapRes.json();
      setParseResult({ ...parsed, soap, pendingSave: true });
    } catch {
      alert('AI 분석 실패');
    }
    setParsing(false);
  }

  async function confirmScores() {
    if (!parseResult || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: parseInt(clientId), session_number: newNumber, raw_text: newText, technique_used: newTechnique }),
      });
      const session = await res.json();
      await fetch(`/api/sessions/${session.id}/scores`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depression_score: parseResult.depression_score,
          anxiety_score: parseResult.anxiety_score,
          anger_score: parseResult.anger_score,
          self_esteem_score: parseResult.self_esteem_score,
          key_persons: JSON.stringify(parseResult.key_persons),
          defense_mechanisms: JSON.stringify(parseResult.defense_mechanisms),
          ai_summary: parseResult.summary || "",
          soap_subjective: parseResult.soap?.subjective || "",
          soap_objective: parseResult.soap?.objective || "",
          soap_assessment: parseResult.soap?.assessment || "",
          soap_plan: parseResult.soap?.plan || "",
          risk_level: parseResult.risk_level || "none",
          risk_keywords: JSON.stringify(parseResult.risk_keywords || []),
        }),
      });
      setParseResult(null);
      setNewText('');
      setNewTechnique('');
      setTab('timeline');
      fetchSessions();
    } finally {
      setSaving(false);
    }
  }

  async function runComparison() {
    if (selectedSessions.length < 2) return;
    const res = await fetch(`/api/sessions/compare?client_id=${clientId}&session_numbers=${selectedSessions.join(',')}`);
    const data = await res.json();
    setComparison(data);
  }

  async function runRAG() {
    const res = await fetch(`/api/rag/recommend/${clientId}`);
    const data = await res.json();
    setRagResult(data);
  }

  async function deleteSession(sessionId: number) {
    if (!confirm('이 세션을 삭제하시겠습니까?')) return;
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    fetchSessions();
  }

  async function saveEditSession() {
    if (!editSession) return;
    await fetch(`/api/sessions/${editSession.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: parseInt(clientId), session_number: editNumber, raw_text: editText, technique_used: editTechnique }),
    });
    // 수치도 저장
    await fetch(`/api/sessions/${editSession.id}/scores`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editScores,
        key_persons: editSession.key_persons,
        defense_mechanisms: editSession.defense_mechanisms,
        ai_summary: editSession.ai_summary,
        soap_subjective: editSoap.subjective,
        soap_objective: editSoap.objective,
        soap_assessment: editSoap.assessment,
        soap_plan: editSoap.plan,
        risk_level: editSession.risk_level || "none",
        risk_keywords: editSession.risk_keywords || "[]",
      }),
    });
    setEditSession(null);
    setTab('timeline');
    fetchSessions();
  }

  async function reParseEditSession() {
    if (!editSession) return;
    // 먼저 텍스트 저장
    await fetch(`/api/sessions/${editSession.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: parseInt(clientId), session_number: editNumber, raw_text: editText, technique_used: editTechnique }),
    });
    // AI 재분석
    const parseRes = await fetch(`/api/sessions/${editSession.id}/parse`, { method: 'POST' });
    const parsed = await parseRes.json();
    // 점수 저장
    await fetch(`/api/sessions/${editSession.id}/scores`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        depression_score: parsed.depression_score,
        anxiety_score: parsed.anxiety_score,
        anger_score: parsed.anger_score,
        self_esteem_score: parsed.self_esteem_score,
        key_persons: JSON.stringify(parsed.key_persons),
        defense_mechanisms: JSON.stringify(parsed.defense_mechanisms),
        ai_summary: parsed.summary || "",
      }),
    });
    setEditSession(null);
    setTab('timeline');
    fetchSessions();
  }

  async function reParseOnly() {
    if (!editSession) return;
    const [parseRes, soapRes] = await Promise.all([
      fetch('/api/sessions/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText }),
      }),
      fetch('/api/sessions/soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText }),
      }),
    ]);
    const parsed = await parseRes.json();
    const soap = await soapRes.json();
    // 점수를 슬라이더에 반영
    setEditScores({
      depression_score: parsed.depression_score,
      anxiety_score: parsed.anxiety_score,
      anger_score: parsed.anger_score,
      self_esteem_score: parsed.self_esteem_score,
    });
    // SOAP를 textarea에 직접 반영
    setEditSoap({
      subjective: soap.subjective || '',
      objective: soap.objective || '',
      assessment: soap.assessment || '',
      plan: soap.plan || '',
    });
    // 위기 레벨 반영
    setEditSession({
      ...editSession,
      risk_level: parsed.risk_level || 'none',
      risk_keywords: JSON.stringify(parsed.risk_keywords || []),
    });
    setEditParseResult(null);
  }

  async function generateSoap() {
    if (!soapText.trim()) return;
    setSoapLoading(true);
    setSoapResult(null);
    try {
      const res = await fetch('/api/sessions/soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: soapText }),
      });
      const data = await res.json();
      setSoapResult(data);
    } catch { setSoapResult(null); }
    setSoapLoading(false);
  }

  function toggleSession(num: number) {
    setSelectedSessions(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);
  }

  // Radar chart data
  const radarData = comparison?.sessions ? comparison.sessions.map((s: any) => ({
    session: `${s.session_number}회차`,
    우울: s.depression, 불안: s.anxiety, 분노: s.anger, 자존감: s.self_esteem,
  })) : [];

  const COLORS = ['#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#9c27b0'];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{ width: 'var(--sidebar-w)', background: '#1a2233', color: 'white', padding: '24px 16px', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 24 }}>🧠 AI 상담 보조</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <a href="/" style={{ padding: '10px 12px', borderRadius: 8, color: '#aaa', textDecoration: 'none', fontSize: '0.9rem' }}>← 내담자 목록</a>
            <button onClick={() => setTab('timeline')} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, background: tab === 'timeline' ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'white', fontSize: '0.9rem' }}>📋 타임라인</button>
            <button onClick={() => setTab('new')} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, background: tab === 'new' ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'white', fontSize: '0.9rem' }}>✍️ 새 일지 작성</button>
            <button onClick={() => setTab('compare')} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, background: tab === 'compare' ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'white', fontSize: '0.9rem' }}>📊 세션 비교</button>
            <button onClick={() => { setTab('rag'); runRAG(); }} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, background: tab === 'rag' ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'white', fontSize: '0.9rem' }}>🔍 유사 케이스</button>
          </nav>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
          <p style={{ fontSize: '0.85rem', marginBottom: 8 }}>👤 {typeof window !== 'undefined' && JSON.parse(localStorage.getItem('counselor') || '{}').name}</p>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }} style={{ width: '100%', padding: '8px', fontSize: '0.8rem', background: 'rgba(255,0,0,0.2)', color: '#ff8a80', borderRadius: 6 }}>로그아웃</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: 32, marginLeft: 'var(--sidebar-w)', maxWidth: 1100, minHeight: '100vh', overflow: 'auto' }}>
        {client && <h1 style={{ fontSize: '1.4rem', marginBottom: 4 }}>{client.name} ({client.age}세, {client.gender === 'M' ? '남' : '여'})</h1>}
        {client?.presenting_issue && <p style={{ color: 'var(--text-light)', marginBottom: 24 }}>{client.presenting_issue}</p>}

        {/* Timeline Tab */}
        {tab === 'timeline' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>회차별 타임라인</h2>
            {sessions.length === 0 ? (
              <p style={{ color: 'var(--text-light)' }}>아직 상담 기록이 없습니다.</p>
            ) : sessions.map(s => (
              <div key={s.id} className="card" style={{ marginBottom: 12, borderLeft: s.risk_level === 'crisis' ? '4px solid #dc2626' : s.risk_level === 'warning' ? '4px solid #f59e0b' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{s.session_number}회차</strong>
                    {s.risk_level === 'crisis' && <span style={{ fontSize: '0.75rem', background: '#dc2626', color: 'white', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>🚨 위기</span>}
                    {s.risk_level === 'warning' && <span style={{ fontSize: '0.75rem', background: '#f59e0b', color: 'white', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>⚠️ 주의</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{s.technique_used || '기법 미기록'}</span>
                    <button onClick={() => { setEditSession(s); setTab('edit'); }} style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#e8f0fe', color: 'var(--primary)', borderRadius: 6 }}>수정</button>
                    <button onClick={() => deleteSession(s.id)} style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#fce8e6', color: 'var(--danger)', borderRadius: 6 }}>삭제</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, margin: '8px 0', fontSize: '0.85rem' }}>
                  <span>우울 <strong>{s.depression_score}</strong></span>
                  <span>불안 <strong>{s.anxiety_score}</strong></span>
                  <span>분노 <strong>{s.anger_score}</strong></span>
                  <span>자존감 <strong>{s.self_esteem_score}</strong></span>
                </div>
                {s.ai_summary && <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{s.ai_summary}</p>}
              </div>
            ))}
          </div>
        )}

        {/* New Session Tab */}
        {tab === 'new' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>새 상담 일지 작성</h2>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <input type="number" value={newNumber} onChange={e => setNewNumber(parseInt(e.target.value) || 1)} style={{ width: 100 }} placeholder="회차" />
              <input value={newTechnique} onChange={e => setNewTechnique(e.target.value)} placeholder="사용 기법 (예: CBT, ACT)" style={{ width: 200 }} />
            </div>
            <textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="상담 내용을 자유롭게 작성하세요..." style={{ marginBottom: 12 }} />

            {/* 음성 입력 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              {!recording ? (
                <button className="btn-outline" onClick={startRecording} disabled={transcribing}>
                  🎙️ 녹음 시작
                </button>
              ) : (
                <button style={{ background: '#dc2626', color: 'white', padding: '10px 20px', borderRadius: 8, animation: 'pulse 1s infinite' }} onClick={stopRecording}>
                  ⏹️ 녹음 중지
                </button>
              )}
              <label className="btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                📁 음성파일 업로드
                <input type="file" accept="audio/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              {transcribing && <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>🔄 변환 중...</span>}
            </div>
            <button className="btn-primary" onClick={submitSession} disabled={parsing}>
              {parsing ? '🔄 AI 분석 중...' : '📤 저장 & AI 분석'}
            </button>

            {/* Parse Result */}
            {parseResult && (
              <div className="card" style={{ marginTop: 16 }}>
                {/* 위기 배지 */}
                {parseResult.risk_level === 'crisis' && (
                  <div style={{ background: '#fef2f2', border: '1px solid #dc2626', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.3rem' }}>🚨</span>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626' }}>위기 개입 필요 (Crisis)</p>
                      <p style={{ fontSize: '0.8rem', color: '#991b1b' }}>감지 키워드: {parseResult.risk_keywords?.join(', ')}</p>
                    </div>
                  </div>
                )}
                {parseResult.risk_level === 'warning' && (
                  <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.3rem' }}>⚠️</span>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d97706' }}>고위험 키워드 감지 (Warning)</p>
                      <p style={{ fontSize: '0.8rem', color: '#92400e' }}>감지 키워드: {parseResult.risk_keywords?.join(', ')}</p>
                    </div>
                  </div>
                )}

                <h3 style={{ marginBottom: 12 }}>🤖 AI 분석 결과 (수정 가능)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  {['depression_score', 'anxiety_score', 'anger_score', 'self_esteem_score'].map(key => (
                    <div key={key}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                        {key === 'depression_score' ? '우울' : key === 'anxiety_score' ? '불안' : key === 'anger_score' ? '분노' : '자존감'}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="range" min={0} max={100} step={1} value={parseResult[key]}
                          onChange={e => setParseResult({...parseResult, [key]: parseInt(e.target.value)})} style={{ flex: 1 }} />
                        <input type="number" min={0} max={100} value={parseResult[key]}
                          onChange={e => setParseResult({...parseResult, [key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))})}
                          style={{ width: 55, textAlign: 'center', padding: '4px 6px', fontSize: '0.85rem' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>핵심 인물:</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {parseResult.key_persons?.map((p: string, i: number) => (
                      <span key={i} className="chip">{p}</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>방어기제:</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {parseResult.defense_mechanisms?.map((d: string, i: number) => (
                      <span key={i} className="chip" style={{ background: '#fef3c7', color: '#92400e' }}>{d}</span>
                    ))}
                    {(!parseResult.defense_mechanisms || parseResult.defense_mechanisms.length === 0) && (
                      <span style={{ fontSize: '0.83rem', color: 'var(--text-light)' }}>감지 안됨</span>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 12 }}>{parseResult.summary}</p>
                
                {/* SOAP 초안 */}
                {parseResult.soap && (
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: 8 }}>📋 SOAP 초안 (수정 가능)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ borderLeft: '3px solid #1a73e8', borderRadius: 4 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a73e8', padding: '0 12px' }}>S | Subjective</span>
                        <textarea value={parseResult.soap.subjective} onChange={e => setParseResult({...parseResult, soap: {...parseResult.soap, subjective: e.target.value}})}
                          style={{ border: 'none', background: '#f8faff', fontSize: '0.83rem', minHeight: 60, padding: '6px 12px', resize: 'vertical' }} />
                      </div>
                      <div style={{ borderLeft: '3px solid #34a853', borderRadius: 4 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34a853', padding: '0 12px' }}>O | Objective</span>
                        <textarea value={parseResult.soap.objective} onChange={e => setParseResult({...parseResult, soap: {...parseResult.soap, objective: e.target.value}})}
                          style={{ border: 'none', background: '#f8fff8', fontSize: '0.83rem', minHeight: 60, padding: '6px 12px', resize: 'vertical' }} />
                      </div>
                      <div style={{ borderLeft: '3px solid #f59e0b', borderRadius: 4 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', padding: '0 12px' }}>A | Assessment</span>
                        <textarea value={parseResult.soap.assessment} onChange={e => setParseResult({...parseResult, soap: {...parseResult.soap, assessment: e.target.value}})}
                          style={{ border: 'none', background: '#fffef8', fontSize: '0.83rem', minHeight: 60, padding: '6px 12px', resize: 'vertical' }} />
                      </div>
                      <div style={{ borderLeft: '3px solid #9c27b0', borderRadius: 4 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9c27b0', padding: '0 12px' }}>P | Plan</span>
                        <textarea value={parseResult.soap.plan} onChange={e => setParseResult({...parseResult, soap: {...parseResult.soap, plan: e.target.value}})}
                          style={{ border: 'none', background: '#fdf8ff', fontSize: '0.83rem', minHeight: 60, padding: '6px 12px', resize: 'vertical' }} />
                      </div>
                    </div>
                  </div>
                )}

                <button className="btn-secondary" onClick={confirmScores} disabled={saving}>
                  {saving ? '저장 중...' : '✓ 확정 저장'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Compare Tab */}
        {tab === 'compare' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>다중 세션 비교</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {sessions.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: selectedSessions.includes(s.session_number) ? '#e8f0fe' : '#f1f3f4', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={selectedSessions.includes(s.session_number)}
                    onChange={() => toggleSession(s.session_number)} />
                  {s.session_number}회차
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button className="btn-outline" onClick={() => setSelectedSessions(sessions.slice(-3).map(s => s.session_number))}>최근 3회</button>
              <button className="btn-outline" onClick={() => { const s = sessions; if (s.length >= 3) setSelectedSessions([s[0].session_number, s[Math.floor(s.length/2)].session_number, s[s.length-1].session_number]); }}>처음/중간/현재</button>
              <button className="btn-outline" onClick={() => setSelectedSessions(sessions.map(s => s.session_number))}>전체</button>
              <button className="btn-primary" onClick={runComparison} disabled={selectedSessions.length < 2}>비교 분석</button>
            </div>

            {comparison && comparison.sessions && (
              <>
                {/* Radar Chart */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <h3 style={{ marginBottom: 12 }}>스파이더 차트 (Radar)</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={[
                      { metric: '우울', ...Object.fromEntries(comparison.sessions.map((s: any) => [`${s.session_number}회차`, s.depression])) },
                      { metric: '불안', ...Object.fromEntries(comparison.sessions.map((s: any) => [`${s.session_number}회차`, s.anxiety])) },
                      { metric: '분노', ...Object.fromEntries(comparison.sessions.map((s: any) => [`${s.session_number}회차`, s.anger])) },
                      { metric: '자존감', ...Object.fromEntries(comparison.sessions.map((s: any) => [`${s.session_number}회차`, s.self_esteem])) },
                    ]}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis domain={[0, 100]} />
                      {comparison.sessions.map((s: any, i: number) => (
                        <Radar key={s.session_number} name={`${s.session_number}회차`} dataKey={`${s.session_number}회차`}
                          stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
                      ))}
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Line Chart */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <h3 style={{ marginBottom: 12 }}>추이 그래프</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={comparison.sessions.map((s: any) => ({ name: `${s.session_number}회차`, 우울: s.depression, 불안: s.anxiety, 분노: s.anger, 자존감: s.self_esteem }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="우울" stroke="#ea4335" strokeWidth={2} />
                      <Line type="monotone" dataKey="불안" stroke="#fbbc04" strokeWidth={2} />
                      <Line type="monotone" dataKey="분노" stroke="#ff6d00" strokeWidth={2} />
                      <Line type="monotone" dataKey="자존감" stroke="#34a853" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* AI Insight */}
                {comparison.insight && (
                  <div className="card" style={{ background: '#f0f8ff', border: '1px solid #1a73e8' }}>
                    <h3 style={{ marginBottom: 8 }}>🤖 AI 인사이트</h3>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{comparison.insight}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Edit Session Tab */}
        {tab === 'edit' && editSession && (
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>
              세션 수정 (#{editSession.session_number}회차)
              {editSession.risk_level === 'crisis' && <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#dc2626', color: 'white', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>🚨 위기</span>}
              {editSession.risk_level === 'warning' && <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#f59e0b', color: 'white', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>⚠️ 주의</span>}
            </h2>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <input type="number" value={editNumber} onChange={e => setEditNumber(parseInt(e.target.value) || 1)} style={{ width: 100 }} placeholder="회차" />
              <input value={editTechnique} onChange={e => setEditTechnique(e.target.value)} placeholder="사용 기법" style={{ width: 200 }} />
            </div>
            <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ marginBottom: 12 }} />

            {/* 수치 수동 수정 */}
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>점수 수정</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { key: 'depression_score', label: '우울' },
                  { key: 'anxiety_score', label: '불안' },
                  { key: 'anger_score', label: '분노' },
                  { key: 'self_esteem_score', label: '자존감' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{label}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="range" min={0} max={100} step={1} value={editScores[key as keyof typeof editScores]}
                        onChange={e => setEditScores({ ...editScores, [key]: parseInt(e.target.value) })} style={{ flex: 1 }} />
                      <input type="number" min={0} max={100} value={editScores[key as keyof typeof editScores]}
                        onChange={e => setEditScores({ ...editScores, [key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                        style={{ width: 55, textAlign: 'center', padding: '4px 6px', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SOAP 수정 */}
            <div className="card" style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>📋 SOAP 노트</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ borderLeft: '3px solid #1a73e8', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a73e8', padding: '0 12px' }}>S | Subjective</span>
                  <textarea value={editSoap.subjective} onChange={e => setEditSoap({...editSoap, subjective: e.target.value})}
                    placeholder="내담자의 주관적 호소..."
                    style={{ border: 'none', background: '#f8faff', fontSize: '0.85rem', minHeight: 80, padding: '8px 12px', resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ borderLeft: '3px solid #34a853', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34a853', padding: '0 12px' }}>O | Objective</span>
                  <textarea value={editSoap.objective} onChange={e => setEditSoap({...editSoap, objective: e.target.value})}
                    placeholder="객관적 관찰 사항..."
                    style={{ border: 'none', background: '#f8fff8', fontSize: '0.85rem', minHeight: 80, padding: '8px 12px', resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ borderLeft: '3px solid #f59e0b', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', padding: '0 12px' }}>A | Assessment</span>
                  <textarea value={editSoap.assessment} onChange={e => setEditSoap({...editSoap, assessment: e.target.value})}
                    placeholder="전문적 평가..."
                    style={{ border: 'none', background: '#fffef8', fontSize: '0.85rem', minHeight: 80, padding: '8px 12px', resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ borderLeft: '3px solid #9c27b0', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9c27b0', padding: '0 12px' }}>P | Plan</span>
                  <textarea value={editSoap.plan} onChange={e => setEditSoap({...editSoap, plan: e.target.value})}
                    placeholder="향후 계획..."
                    style={{ border: 'none', background: '#fdf8ff', fontSize: '0.85rem', minHeight: 80, padding: '8px 12px', resize: 'vertical', lineHeight: 1.6 }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={saveEditSession}>저장</button>
              <button className="btn-secondary" onClick={reParseEditSession}>저장 & 재분석</button>
              <button className="btn-outline" onClick={reParseOnly}>재분석만</button>
              <button className="btn-outline" onClick={() => { setEditSession(null); setEditParseResult(null); setTab('timeline'); }}>취소</button>
            </div>

            {/* 재분석 결과 표시 */}
            {editParseResult && (
              <div className="card" style={{ marginTop: 16, background: '#f0f8ff', border: '1px solid var(--primary)' }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>🤖 AI 재분석 결과</h3>
                <p style={{ fontSize: '0.85rem', marginBottom: 8, lineHeight: 1.5 }}><strong>요약:</strong> {editParseResult.summary}</p>
                {editParseResult.key_persons?.length > 0 && (
                  <p style={{ fontSize: '0.85rem', marginBottom: 4 }}><strong>핵심 인물:</strong> {editParseResult.key_persons.join(', ')}</p>
                )}
                {editParseResult.defense_mechanisms?.length > 0 && (
                  <p style={{ fontSize: '0.85rem', marginBottom: 8 }}><strong>방어기제:</strong> {editParseResult.defense_mechanisms.join(', ')}</p>
                )}

                {/* SOAP 초안 */}
                {editParseResult.soap && (
                  <div style={{ marginTop: 8 }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: 8 }}>📋 SOAP 초안</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ padding: '8px 12px', borderLeft: '3px solid #1a73e8', background: '#f8faff', borderRadius: 4 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a73e8' }}>S | Subjective</span>
                        <p style={{ fontSize: '0.83rem', marginTop: 2 }}>{editParseResult.soap.subjective}</p>
                      </div>
                      <div style={{ padding: '8px 12px', borderLeft: '3px solid #34a853', background: '#f8fff8', borderRadius: 4 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34a853' }}>O | Objective</span>
                        <p style={{ fontSize: '0.83rem', marginTop: 2 }}>{editParseResult.soap.objective}</p>
                      </div>
                      <div style={{ padding: '8px 12px', borderLeft: '3px solid #f59e0b', background: '#fffef8', borderRadius: 4 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>A | Assessment</span>
                        <p style={{ fontSize: '0.83rem', marginTop: 2 }}>{editParseResult.soap.assessment}</p>
                      </div>
                      <div style={{ padding: '8px 12px', borderLeft: '3px solid #9c27b0', background: '#fdf8ff', borderRadius: 4 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9c27b0' }}>P | Plan</span>
                        <p style={{ fontSize: '0.83rem', marginTop: 2 }}>{editParseResult.soap.plan}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* RAG Tab */}
        {tab === 'rag' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 16 }}>유사 케이스 기반 추천</h2>
            {!ragResult ? (
              <p style={{ color: 'var(--text-light)' }}>로딩 중...</p>
            ) : (
              <>
                <div className="card" style={{ marginBottom: 16 }}>
                  <h3 style={{ marginBottom: 8 }}>현재 내담자 상태</h3>
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.9rem' }}>
                    <span>우울: {ragResult.current_state?.depression}</span>
                    <span>불안: {ragResult.current_state?.anxiety}</span>
                    <span>분노: {ragResult.current_state?.anger}</span>
                    <span>자존감: {ragResult.current_state?.self_esteem}</span>
                  </div>
                </div>

                {ragResult.recommendations?.length > 0 && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <h3 style={{ marginBottom: 8 }}>유사 케이스</h3>
                    {ragResult.recommendations.map((r: any, i: number) => (
                      <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 600 }}>{r.case_id}</span>
                        <span style={{ marginLeft: 12, color: 'var(--text-light)', fontSize: '0.85rem' }}>유사도: {r.similarity}%</span>
                        <span style={{ marginLeft: 12, fontSize: '0.85rem' }}>기법: {r.technique_used}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="card" style={{ background: '#f0fff4', border: '1px solid var(--secondary)' }}>
                  <h3 style={{ marginBottom: 8 }}>🤖 AI 대안 제안</h3>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{ragResult.suggestion}</p>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
