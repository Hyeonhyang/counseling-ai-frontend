'use client';

import { useState, useEffect } from 'react';

interface DeleteModalProps {
  isOpen: boolean;
  title: string;
  description: string;  // 뭐가 삭제되는지 상세 설명
  itemName: string;     // 삭제 대상 이름
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteModal({ isOpen, title, description, itemName, onConfirm, onCancel }: DeleteModalProps) {
  const [skipToday, setSkipToday] = useState(false);
  const [todaySkipped, setTodaySkipped] = useState(false);

  useEffect(() => {
    const skipUntil = localStorage.getItem('delete_confirm_skip_until');
    if (skipUntil && new Date(skipUntil) > new Date()) {
      setTodaySkipped(true);
    }
  }, [isOpen]);

  // "오늘 하루 묻지 않기" 체크 상태에서 모달이 열리면 바로 삭제
  useEffect(() => {
    if (isOpen && todaySkipped) {
      onConfirm();
    }
  }, [isOpen, todaySkipped]);

  if (!isOpen || todaySkipped) return null;

  function handleConfirm() {
    if (skipToday) {
      const tomorrow = new Date();
      tomorrow.setHours(23, 59, 59, 999);
      localStorage.setItem('delete_confirm_skip_until', tomorrow.toISOString());
    }
    onConfirm();
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 28, maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        {/* 경고 아이콘 */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: '2.5rem' }}>⚠️</span>
        </div>

        {/* 제목 */}
        <h3 style={{ textAlign: 'center', marginBottom: 12, fontSize: '1.1rem' }}>{title}</h3>

        {/* 삭제 대상 강조 */}
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>삭제 대상:</p>
          <p style={{ fontSize: '0.95rem', fontWeight: 700 }}>{itemName}</p>
        </div>

        {/* 상세 설명 */}
        <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.5, marginBottom: 16 }}>{description}</p>

        {/* 경고 문구 */}
        <p style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
          ❗ 이 작업은 되돌릴 수 없습니다
        </p>

        {/* 오늘 하루 묻지 않기 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer', fontSize: '0.83rem', color: '#666' }}>
          <input type="checkbox" checked={skipToday} onChange={e => setSkipToday(e.target.checked)} style={{ width: 16, height: 16 }} />
          오늘 하루 이 확인 팝업을 표시하지 않기
        </label>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px', borderRadius: 8, background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>취소</button>
          <button onClick={handleConfirm} style={{ flex: 1, padding: '12px', borderRadius: 8, background: '#dc2626', color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>삭제</button>
        </div>
      </div>
    </div>
  );
}
