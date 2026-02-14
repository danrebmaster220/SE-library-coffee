const toastColors = {
  success: { bg: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)', border: '#28a745', color: '#155724', icon: '#28a745' },
  error: { bg: 'linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)', border: '#dc3545', color: '#721c24', icon: '#dc3545' },
  warning: { bg: 'linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%)', border: '#ffc107', color: '#856404', icon: '#ffc107' },
  info: { bg: 'linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%)', border: '#17a2b8', color: '#0c5460', icon: '#17a2b8' },
};

const toastIcons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

export default function Toast({ toast, onClose }) {
  if (!toast.show) return null;
  const colors = toastColors[toast.type] || toastColors.info;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px 24px',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
      minWidth: '300px',
      maxWidth: '500px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      color: colors.color,
      animation: 'toastSlideIn 0.3s ease-out',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        fontWeight: 'bold',
        flexShrink: 0,
        background: colors.icon,
        color: 'white',
      }}>
        {toastIcons[toast.type] || 'ℹ'}
      </div>
      <div style={{ flex: 1, fontSize: '15px', fontWeight: 500, lineHeight: 1.4 }}>{toast.message}</div>
      <button style={{
        background: 'transparent',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        opacity: 0.6,
        padding: 0,
        lineHeight: 1,
        color: 'inherit',
      }} onClick={onClose}>×</button>
    </div>
  );
}
