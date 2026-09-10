import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronDown,
  FileImage,
  Flag,
  Gauge,
  HeartHandshake,
  ImageOff,
  Info,
  LockKeyhole,
  Menu,
  MessageSquarePlus,
  Paperclip,
  PencilLine,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { checkVehicle, getCommunityReports, submitReport } from '@/lib/data';
import { extractRideDetails } from '@/lib/ai';
import type { CommunityReportView, ResultKind, VehicleCheckResult } from '@/lib/types';

const logoUrl = '/logo.png';

type Screen = 'home' | 'check' | 'analyzing' | 'result' | 'reports' | 'report' | 'cantRead';

type CantReadInfo = { reason: 'low_confidence' | 'error'; message: string };

const categories = ['Harassment / inappropriate behaviour', 'Unsafe driving', 'Threatening behaviour', 'Driver followed me', 'Driver contacted me after the ride', 'Verbal abuse', 'Route-related concern', 'Other'];

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [checkResult, setCheckResult] = useState<VehicleCheckResult | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('KA 01 AB 1234');
  const [cantRead, setCantRead] = useState<CantReadInfo | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCheck = (): void => setScreen('check');

  const lookupAndShow = async (registrationNumber: string): Promise<void> => {
    setScreen('analyzing');
    const result = await checkVehicle(registrationNumber);
    setCheckResult(result);
    setScreen('result');
  };

  const runManualCheck = (): void => {
    void lookupAndShow(vehicleNumber);
  };

  const analyzeScreenshot = async (file: File): Promise<void> => {
    setScreen('analyzing');
    const outcome = await extractRideDetails(file);

    if (outcome.status === 'success') {
      setVehicleNumber(outcome.vehicleNumber);
      await lookupAndShow(outcome.vehicleNumber);
      return;
    }

    // Never fall through to a database lookup on an uncertain plate
    // (PROJECT_CONTEXT.md §12, §14). Ask the user to retry or type it in.
    setCantRead(
      outcome.status === 'low_confidence'
        ? { reason: 'low_confidence', message: "We couldn't clearly read the vehicle number." }
        : { reason: 'error', message: outcome.message }
    );
    setScreen('cantRead');
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = ''; // let the same file be picked again after a retry
    if (file) void analyzeScreenshot(file);
  };
  const goToReports = (): void => setScreen('reports');
  const toggleCategory = (category: string): void => {
    setSelectedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const regNumber = String(formData.get('vehicle') ?? '');
    const platform = String(formData.get('platform') ?? 'Other');
    const description = String(formData.get('description') ?? '');
    const rideDate = String(formData.get('ride_date') ?? '');
    const result = await submitReport({
      registrationNumber: regNumber,
      platform,
      categories: selectedCategories.length > 0 ? selectedCategories : ['Other'],
      description,
      rideDate,
    });
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
    } else {
      setSubmitError(result.error ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="app-shell">
      <Header screen={screen} onNavigate={setScreen} />
      <main className="page-content">
        {screen === 'home' && <Home onCheck={openCheck} onFile={handleFile} onReport={() => setScreen('report')} onReports={goToReports} />}
        {screen === 'check' && <CheckRide onBack={() => setScreen('home')} onFile={handleFile} onManual={runManualCheck} vehicleNumber={vehicleNumber} setVehicleNumber={setVehicleNumber} />}
        {screen === 'analyzing' && <Analyzing />}
        {screen === 'cantRead' && cantRead && <CantRead info={cantRead} onFile={handleFile} onManual={() => { setCantRead(null); setScreen('check'); }} />}
        {screen === 'result' && checkResult && <Result result={checkResult} vehicleNumber={vehicleNumber} onBack={openCheck} onReports={goToReports} onReport={() => setScreen('report')} />}
        {screen === 'reports' && checkResult && <CommunityReports vehicleNumber={vehicleNumber} setVehicleNumber={setVehicleNumber} onBack={() => setScreen('home')} onCheck={runManualCheck} onUpload={openCheck} result={checkResult} />}
        {screen === 'report' && (submitted ? <Submitted onHome={() => { setSubmitted(false); setScreen('home'); }} /> : <ReportRide selectedCategories={selectedCategories} onToggle={toggleCategory} onSubmit={handleSubmit} onBack={() => setScreen('home')} submitting={submitting} submitError={submitError} />)}
      </main>
      <BottomNav screen={screen} onNavigate={setScreen} />
    </div>
  );
}

type HeaderProps = { screen: Screen; onNavigate: (screen: Screen) => void };
function Header({ screen, onNavigate }: HeaderProps) {
  const backEnabled = screen !== 'home';
  return (
    <header className="topbar">
      <div className="topbar-inner">
        {backEnabled ? <button className="icon-button" aria-label="Go back" onClick={() => onNavigate('home')}><ArrowLeft size={21} /></button> : <div className="brand-mark"><img src={logoUrl} alt="SpotRealRedFlag flower logo" /></div>}
        <button className="brand-lockup" onClick={() => onNavigate('home')}>
          <strong>SpotRealRedFlag</strong>
          <span>{screen === 'home' ? "Women's ride safety radar" : screen === 'reports' ? 'Community reports' : 'Check ride'}</span>
        </button>
        <button className="safety-pill" onClick={() => onNavigate('home')}><ShieldCheck size={16} /> <span>Safety</span></button>
      </div>
    </header>
  );
}

function Home({ onCheck, onFile, onReport, onReports }: { onCheck: () => void; onFile: (event: ChangeEvent<HTMLInputElement>) => void; onReport: () => void; onReports: () => void }) {
  return <>
    <section className="hero-section">
      <div className="eyebrow"><HeartHandshake size={14} /> Anonymous solidarity <span className="live-dot" /> Strictly anonymous</div>
      <h1>Before you get in… <span className="soft-emoji">👀</span></h1>
      <h2>Let's check that ride.</h2>
      <p>Upload your ride screenshot to see whether other women have reported concerns about this vehicle.</p>
    </section>
    <section className="upload-card home-upload">
      <label className="drop-zone" htmlFor="home-file"><span className="upload-icon"><FileImage size={25} /></span><strong>Drop ride screenshot here</strong><span>Tap to browse your photo library</span><input id="home-file" type="file" accept="image/*" onChange={onFile} /></label>
      <div className="supported"><span>Supports:</span>{['Uber', 'Ola', 'Rapido', 'Namma Yatri'].map((platform) => <span className="tag" key={platform}>{platform}</span>)}</div>
      <button className="primary-button" onClick={onCheck}>Check my ride <ArrowRight size={18} /></button>
      <button className="text-action" onClick={onCheck}>Enter vehicle number manually <ArrowRight size={15} /></button>
      <small className="muted-center">No login. No fuss. Just a quick check.</small>
    </section>
    <section className="how-section"><h3>How it works</h3><div className="steps">{[['1', 'Upload your screenshot', 'Snap your active booking confirmation screen.'], ['2', 'We identify the vehicle', 'On-device OCR reads the registration plate.'], ['3', 'See community reports', 'Instantly know if other women flagged this ride.']].map(([number, title, text]) => <div className="step" key={number}><span className="step-number">{number}</span><div><strong>{title}</strong><span>{text}</span></div></div>)}</div></section>
    <button className="happened-card" onClick={onReport}><span className="happened-icon"><MessageSquarePlus size={20} /></span><span><strong>Something happened?</strong><small>Tell us what went down</small></span><ArrowRight size={18} /></button>
    <FooterLinks onReports={onReports} />
  </>;
}

function CheckRide({ onBack, onFile, onManual, vehicleNumber, setVehicleNumber }: { onBack: () => void; onFile: (event: ChangeEvent<HTMLInputElement>) => void; onManual: () => void; vehicleNumber: string; setVehicleNumber: (value: string) => void }) {
  return <>
    <div className="section-heading"><div className="eyebrow"><Sparkles size={14} /> AI plate scan</div><h1>Let's check your ride.</h1><p>Upload a screenshot from your cab or auto booking app.</p></div>
    <section className="upload-card">
      <div className="large-upload"><span className="upload-icon"><Camera size={25} /></span><strong>Drop or upload your screenshot here</strong><span>We automatically detect and cross-reference the vehicle registration.</span><label className="primary-button" htmlFor="ride-file"><Upload size={17} /> Choose screenshot<input id="ride-file" type="file" accept="image/*" onChange={onFile} /></label><div className="platform-tags">{['Uber', 'Ola', 'Rapido', 'Namma Yatri'].map((platform) => <span className="tag" key={platform}>{platform}</span>)}</div><small className="privacy-line"><Sparkles size={14} /> Instant plate recognition · No login required</small></div>
      <div className="action-grid"><button onClick={() => document.getElementById('ride-file')?.click()}><Camera size={19} /><span><strong>Take photo</strong><small>Plate or dashboard</small></span></button><button onClick={() => document.getElementById('ride-file')?.click()}><FileImage size={19} /><span><strong>Choose from gallery</strong><small>Recent captures</small></span></button></div>
      <div className="manual-panel"><label htmlFor="manual-number">Or enter vehicle number manually</label><div className="manual-input"><span>IND</span><input id="manual-number" value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} placeholder="KA 01 AB 1234" /><button aria-label="Check vehicle number" onClick={onManual}><Search size={18} /></button></div><button className="secondary-button" onClick={onManual}>Check vehicle</button></div>
    </section>
    <div className="privacy-card"><span className="privacy-icon"><LockKeyhole size={17} /></span><div><strong>Privacy Promise</strong><p>Your screenshot is only used to identify the vehicle. Avoid uploading unnecessary personal information.</p></div></div>
    <button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Back to home</button>
  </>;
}

function Analyzing() {
  return <section className="center-state"><div className="scan-orb"><img src={logoUrl} alt="SpotRealRedFlag" /></div><h1>Checking your ride…</h1><p>Reading the vehicle details and checking community reports.</p><div className="progress-list"><div><Check size={17} /> Identifying vehicle</div><div className="active"><Gauge size={17} /> Checking community reports</div><div className="faded"><span className="empty-circle" /> Almost there</div></div></section>;
}

function CantRead({ info, onFile, onManual }: { info: CantReadInfo; onFile: (event: ChangeEvent<HTMLInputElement>) => void; onManual: () => void }) {
  const isError = info.reason === 'error';
  return <section className="center-state">
    <div className="scan-orb"><ImageOff size={30} color="#3525cd" /></div>
    <h1>{isError ? "That screenshot didn't go through" : "We couldn't clearly read the vehicle number"}</h1>
    <p>{isError ? info.message : 'The screenshot was a little unclear. Try a sharper one, or type the vehicle number in yourself.'}</p>
    <div style={{ width: '100%', maxWidth: 340, marginTop: 26 }}>
      <label className="primary-button" htmlFor="retry-file"><RefreshCw size={17} /> Upload another screenshot<input id="retry-file" type="file" accept="image/*" onChange={onFile} hidden /></label>
      <button className="outline-button" onClick={onManual}><PencilLine size={16} /> Enter vehicle number manually</button>
    </div>
  </section>;
}

function Result({ result, vehicleNumber, onBack, onReports, onReport }: { result: VehicleCheckResult; vehicleNumber: string; onBack: () => void; onReports: () => void; onReport: () => void }) {
  const kind: ResultKind = result.resultKind;
  const content = kind === 'clear' ? { label: 'No reports found', title: 'No reports found', text: "We haven't received any community reports associated with this vehicle." } : kind === 'caution' ? { label: 'Reports found', title: 'A few reports to know about', text: 'Community reports have been associated with this vehicle. Take a moment to review them.' } : { label: 'Red flag', title: "I'd pause before getting in", text: 'Multiple reports have been associated with this vehicle. Consider cancelling this ride and booking another.' };
  return <>
    <div className="result-top"><div className={`status-dot ${kind}`} /> <span>{content.label}</span><span className="result-count">{result.reportCount} {result.reportCount === 1 ? 'report' : 'reports'}</span></div>
    <section className="vehicle-card"><div><small>Vehicle registration</small><h2>{vehicleNumber}</h2><span>{result.vehicle ? 'Found in community database' : 'No vehicle record yet'}</span></div><span className="car-icon">▣</span></section>
    <section className={`result-card ${kind}`}><div className="result-label"><span className="status-dot" /> {content.label}</div><h1>{content.title}</h1><p>{content.text}</p>{kind !== 'clear' && <button className="text-action aligned" onClick={onReports}>View community reports <ArrowRight size={15} /></button>}</section>
    <section className="notice-card"><Info size={18} /><div><strong>Important note</strong><p>{kind === 'clear' ? "No reports does not guarantee that a ride is safe. It only means we don't currently have reports associated with this vehicle." : 'Reports are submitted by users and have not been independently verified.'}</p></div></section>
    <button className="primary-button" onClick={onBack}><Search size={18} /> Check another ride</button><button className="outline-button" onClick={onReport}><Flag size={17} /> Report this ride</button>
    <button className="how-safety" onClick={onReports}><Shield size={18} /> How community safety works <ChevronDown size={18} /></button>
  </>;
}

function CommunityReports({ vehicleNumber, setVehicleNumber, onBack, onCheck, onUpload, result }: { vehicleNumber: string; setVehicleNumber: (value: string) => void; onBack: () => void; onCheck: () => void; onUpload: () => void; result: VehicleCheckResult }) {
  const [communityReports, setCommunityReports] = useState<CommunityReportView[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (result.vehicle) {
      void getCommunityReports(result.vehicle.id).then((reports) => {
        setCommunityReports(reports);
        setLoading(false);
      });
    } else {
      setCommunityReports([]);
      setLoading(false);
    }
  }, [result.vehicle]);

  const reportCount = result.reportCount;

  return <><div className="section-heading compact"><div className="eyebrow"><BadgeCheck size={14} /> Community verified ride check</div><h1>Community reports</h1><p>Search a vehicle to see anonymous experiences shared by other women.</p></div><section className="search-card"><label htmlFor="report-search">Search a vehicle</label><div className="manual-input"><span>IND</span><input id="report-search" value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} /><button aria-label="Clear vehicle number" onClick={() => setVehicleNumber('')}><X size={17} /></button></div><button className="primary-button" onClick={onCheck}><Shield size={17} /> Check vehicle</button><button className="text-action" onClick={onUpload}>Or upload a screenshot instead <ArrowRight size={15} /></button></section><section className="overview-card"><small>Vehicle overview</small><strong>{vehicleNumber} <span>· {result.vehicle ? 'In database' : 'Not yet recorded'}</span></strong><span className="report-count">{reportCount} community {reportCount === 1 ? 'report' : 'reports'}</span><div className="filter-row"><span className="selected">All Reports ({reportCount})</span></div></section>{loading ? <div className="disclaimer">Loading reports…</div> : communityReports && communityReports.length > 0 ? <div className="report-list">{communityReports.map((report) => <article className="community-report" key={report.id}><div className="report-meta"><span className="report-chip"><span className="tiny-dot" />{report.category}</span><small>{report.date}</small></div><blockquote>“{report.quote}”</blockquote><footer><span><LockKeyhole size={13} /> Anonymous report</span><span>{report.platform}</span></footer></article>)}</div> : <div className="disclaimer">No community reports found for this vehicle yet.</div>}<div className="disclaimer"><Info size={16} /> Reports are user-submitted experiences and have not been independently verified.</div><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Back to home</button></>;
}

function ReportRide({ selectedCategories, onToggle, onSubmit, onBack, submitting, submitError }: { selectedCategories: string[]; onToggle: (category: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onBack: () => void; submitting: boolean; submitError: string | null }) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('Uber');
  return <form className="report-form" onSubmit={onSubmit}><div className="section-heading compact"><div className="eyebrow"><MessageSquarePlus size={14} /> Anonymous solidarity</div><h1>Something happened?</h1><p>Tell us what went down. Your experience could help another woman make a more informed decision.</p></div><div className="zero-footprint"><ShieldCheck size={17} /><div><strong>Zero digital footprint</strong><span>Your identity is not displayed publicly. No login required.</span></div></div><section className="form-card"><label htmlFor="report-vehicle">Vehicle registration number <small>Required</small></label><div className="manual-input"><span>IND</span><input id="report-vehicle" name="vehicle" defaultValue="KA 01 AB 1234" required /></div><small>Format: KA 01 AB 1234 · Found on the vehicle plate or app receipt.</small></section><section className="form-card"><label>Ride platform</label><div className="choice-row"><input type="hidden" name="platform" value={selectedPlatform} />{['Uber', 'Ola', 'Rapido', 'Namma Yatri', 'Other'].map((platform) => <button type="button" key={platform} className={selectedPlatform === platform ? 'platform-chosen' : ''} onClick={() => setSelectedPlatform(platform)}>{platform}</button>)}</div></section><section className="form-card"><label>What happened? <small>Select all that apply</small></label><div className="category-grid">{categories.map((category) => <button type="button" className={selectedCategories.includes(category) ? 'chosen' : ''} onClick={() => onToggle(category)} key={category}><span />{category}</button>)}</div></section><section className="form-card"><label htmlFor="description">Tell us what happened</label><textarea id="description" name="description" maxLength={600} required placeholder="Tell us what happened..." /><small>Please don't include unnecessary personal information about yourself or anyone else.</small></section><section className="form-card"><label htmlFor="ride-date">Ride date <small>Required</small></label><input className="date-input" id="ride-date" name="ride_date" type="date" required /></section><section className="evidence-card"><div><Paperclip size={18} /><strong>Optional evidence</strong></div><button type="button"><FileImage size={18} /> Add screenshot</button><small>Only upload evidence you are comfortable sharing.</small></section>{submitError && <div className="disclaimer" style={{ color: '#ba1a1a' }}>{submitError}</div>}<button className="primary-button submit-button" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : <><LockKeyhole size={17} /> Submit report</>}</button><button type="button" className="back-link" onClick={onBack}>Cancel and go back</button></form>;
}

function Submitted({ onHome }: { onHome: () => void }) {
  return <section className="center-state submitted"><div className="success-orb"><Check size={31} /></div><div className="eyebrow">Thank you for looking out</div><h1>Your report was submitted.</h1><p>Thanks for looking out for the next girl. Your anonymous experience is now part of the community safety record.</p><button className="primary-button" onClick={onHome}>Back to home <ArrowRight size={17} /></button></section>;
}

function FooterLinks({ onReports }: { onReports: () => void }) {
  return <footer className="footer-links"><button onClick={onReports}>Community reports</button><span>·</span><button>Safety</button><span>·</span><button>Privacy</button><span>·</span><button>Terms</button><small><LockKeyhole size={13} /> Zero logs · Local on-device scan</small></footer>;
}

function BottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  return <nav className="bottom-nav"><button className={screen === 'home' ? 'active' : ''} onClick={() => onNavigate('home')}><Shield size={19} /><span>Home</span></button><button className={['check', 'analyzing', 'result', 'reports', 'cantRead'].includes(screen) ? 'active' : ''} onClick={() => onNavigate('check')}><Search size={19} /><span>Check</span></button><button className={screen === 'report' ? 'active' : ''} onClick={() => onNavigate('report')}><Flag size={19} /><span>Report</span></button><button className="desktop-only"><Menu size={19} /><span>More</span></button></nav>;
}

export default App;
