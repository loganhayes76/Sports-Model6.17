import './LoadingScreen.css'

export default function LoadingScreen({ text = 'Loading data...' }) {
  return (
    <div className="ss-loading-overlay">
      <div className="ss-loading-content">
        <img
          src="/SSLogo.png"
          alt="SpreadSlayer"
          className="ss-loading-logo"
        />
        <div className="ss-katana-track">
          <img
            src="/SSKatana.png"
            alt=""
            className="ss-katana-slash"
            aria-hidden="true"
          />
        </div>
        <p className="ss-loading-text">{text}</p>
      </div>
    </div>
  )
}
