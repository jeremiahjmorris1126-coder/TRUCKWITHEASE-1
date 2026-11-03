import React, { useState, useRef, useEffect } from 'react';
import {
  ElectronicDvirRecord,
  DvirDefectItem,
  DvirInspectionType,
} from '../types';
import {
  crossFunctionMemoryService,
  DEFAULT_DVIR_COMPONENTS,
} from '../services/crossFunctionMemoryService';
import { DRIVER_INFO } from '../data/mockData';

interface DvirManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  activeJ1939Faults?: { spn: number; fmi: number; description: string; system: string }[];
}

type ModalViewTab = 'LIST' | 'CREATE_NEW' | 'SCAN_UPLOAD' | 'VIEW_DETAIL';

export const DvirManagementModal: React.FC<DvirManagementModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  activeJ1939Faults = [
    { spn: 3251, fmi: 0, description: 'Particulate Trap Differential Pressure Above Normal', system: 'AFTERTREATMENT / DPF' },
    { spn: 110, fmi: 3, description: 'Engine Coolant Temp Sensor Circuit High Voltage', system: 'COOLING / THERMAL' },
  ],
}) => {
  const [activeTab, setActiveTab] = useState<ModalViewTab>('LIST');
  const [dvirs, setDvirs] = useState<ElectronicDvirRecord[]>(() =>
    crossFunctionMemoryService.getAllDvirs()
  );
  const [selectedDvirForDetail, setSelectedDvirForDetail] = useState<ElectronicDvirRecord | null>(null);

  // Form State: Create New DVIR
  const [inspectionType, setInspectionType] = useState<DvirInspectionType>('PRE_TRIP');
  const [truckUnit, setTruckUnit] = useState<string>('TRK-904');
  const [trailerUnit, setTrailerUnit] = useState<string>('TRL-5321');
  const [odometerMiles, setOdometerMiles] = useState<number>(142850);
  const [defectsList, setDefectsList] = useState<DvirDefectItem[]>(() =>
    DEFAULT_DVIR_COMPONENTS.map((c, i) => ({ ...c, id: `comp-create-${i}` }))
  );
  const [driverSig, setDriverSig] = useState<string>(DRIVER_INFO.name);
  const [mechanicSig, setMechanicSig] = useState<string>('');
  const [mechanicNotes, setMechanicNotes] = useState<string>('');
  const [isMechanicAttested, setIsMechanicAttested] = useState<boolean>(false);

  // Camera & Scan Upload State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [scannedImageDataUrl, setScannedImageDataUrl] = useState<string | null>(null);
  const [scanOdometer, setScanOdometer] = useState<number>(142850);
  const [scanTruckUnit, setScanTruckUnit] = useState<string>('TRK-904');
  const [scanTrailerUnit, setScanTrailerUnit] = useState<string>('TRL-5321');
  const [scanNotes, setScanNotes] = useState<string>('Physical paper DVIR form photographed and certified in cab.');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return crossFunctionMemoryService.subscribe((snapshot) => {
      setDvirs(snapshot.dvirs);
    });
  }, []);

  // Stop camera when leaving scan tab or closing modal
  useEffect(() => {
    if ((activeTab !== 'SCAN_UPLOAD' || !isOpen) && cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      setCameraActive(false);
    }
  }, [activeTab, isOpen, cameraStream]);

  if (!isOpen) return null;

  // Toggle Defect Status
  const handleToggleDefect = (index: number) => {
    setDefectsList((prev) => {
      const copy = [...prev];
      const target = copy[index];
      const newHasDefect = !target.hasDefect;
      copy[index] = {
        ...target,
        hasDefect: newHasDefect,
        severity: newHasDefect ? 'ADVISORY' : 'NOMINAL',
      };
      return copy;
    });
  };

  // Import Active J1939 DTCs from Master Mechanic
  const handleImportJ1939Faults = () => {
    if (!activeJ1939Faults || activeJ1939Faults.length === 0) {
      onShowToast('ZERO ACTIVE J1939 CODES DETECTED // CAN-BUS NOMINAL', 'check_circle');
      return;
    }

    const imported = crossFunctionMemoryService.importJ1939FaultsToDvir(activeJ1939Faults);
    setDefectsList(imported);
    onShowToast(`IMPORTED ${activeJ1939Faults.length} J1939 FAULT CODES INTO DVIR CHECKLIST`, 'build');
  };

  // Submit New Electronic DVIR
  const handleSaveElectronicDvir = (e: React.FormEvent) => {
    e.preventDefault();
    const defectsCount = defectsList.filter((d) => d.hasDefect).length;

    const newRecord = crossFunctionMemoryService.createDvir({
      inspectionType,
      truckUnit,
      trailerUnit,
      odometerMiles,
      defects: defectsList,
      conditionSatisfactory: defectsCount === 0,
      defectsCorrected: isMechanicAttested,
      driverSignature: driverSig,
      mechanicSignature: isMechanicAttested ? (mechanicSig || 'Certified Heavy Duty Fleet Tech') : undefined,
      mechanicNotes: isMechanicAttested ? mechanicNotes : undefined,
      mechanicFacilityName: isMechanicAttested ? 'Corridor Mobile Fleet Repair' : undefined,
    });

    onShowToast(`CREATED CERTIFIED ${inspectionType} DVIR // ${newRecord.dvirNumber}`, 'verified');
    setActiveTab('LIST');
  };

  // Camera Activation
  const handleStartCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        setCameraStream(stream);
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } else {
        onShowToast('CAMERA HARDWARE NOT ACCESSIBLE // USE FILE UPLOAD', 'warning');
      }
    } catch {
      onShowToast('CAMERA PERMISSION DENIED // FALLING BACK TO FILE UPLOAD', 'warning');
    }
  };

  // Capture Snapshot
  const handleCaptureSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setScannedImageDataUrl(dataUrl);
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop());
          setCameraStream(null);
          setCameraActive(false);
        }
        onShowToast('PAPER DVIR PHOTOGRAPHED // VERIFY AND UPLOAD', 'photo_camera');
      }
    }
  };

  // File Upload Fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setScannedImageDataUrl(dataUrl);
        onShowToast(`LOADED SCANNED FILE: ${file.name}`, 'attach_file');
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Scanned Paper DVIR
  const handleSaveScannedDvir = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedImageDataUrl) {
      onShowToast('PLEASE CAPTURE OR UPLOAD A DVIR IMAGE FIRST', 'warning');
      return;
    }

    const scanned = crossFunctionMemoryService.scanAndUploadPaperDvir({
      scannedImageDataUrl,
      inspectionType,
      odometerMiles: scanOdometer,
      truckUnit: scanTruckUnit,
      trailerUnit: scanTrailerUnit,
      notes: scanNotes,
    });

    onShowToast(`PAPER DVIR SCANNED & ARCHIVED TO FEDERAL VAULT // ${scanned.dvirNumber}`, 'document_scanner');
    setScannedImageDataUrl(null);
    setActiveTab('LIST');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto font-mono">
      <div className="relative w-full max-w-5xl bg-[#05080E] border-2 border-primary/70 rounded-2xl shadow-[0_0_35px_rgba(255,229,0,0.2)] text-white overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* HEADER BAR */}
        <div className="flex items-center justify-between p-4 bg-[#0A0F14] border-b border-[#1E2532] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE500]/15 border border-[#FFE500]/40 flex items-center justify-center text-[#FFE500]">
              <span className="material-symbols-outlined text-[24px]">fact_check</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-['Space_Grotesk'] font-black uppercase tracking-wider text-white">
                  DRIVER VEHICLE INSPECTION REPORTS (DVIR)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  49 CFR § 396.11 &bull; 396.13
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Pre-Trip &amp; Post-Trip Vehicle Inspections • J1939 DTC Fault Ingestion • Mobile Scanner &amp; Upload
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* SUB-TAB NAV BAR */}
        <div className="flex items-center gap-2 bg-[#0A0F14] p-2 border-b border-[#1E2532] text-xs font-bold uppercase shrink-0">
          <button
            onClick={() => setActiveTab('LIST')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'LIST'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_12px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            <span>DVIR Archive ({dvirs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('CREATE_NEW')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'CREATE_NEW'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_12px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">edit_document</span>
            <span>Create Electronic DVIR</span>
          </button>

          <button
            onClick={() => setActiveTab('SCAN_UPLOAD')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'SCAN_UPLOAD'
                ? 'bg-[#FFE500] text-black font-black shadow-[0_0_12px_rgba(255,229,0,0.35)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">document_scanner</span>
            <span>Scan &amp; Upload Paper DVIR</span>
          </button>
        </div>

        {/* TAB 1: DVIR ARCHIVE LIST */}
        {activeTab === 'LIST' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#FFE500] uppercase tracking-wider">
                Permanent 49 CFR § 396 Vehicle Inspection Ledger
              </span>
              <span className="text-[11px] text-slate-400">Retention: 3 Months Mandatory</span>
            </div>

            <div className="space-y-3">
              {dvirs.map((dvir) => {
                const hasDefects = dvir.defectsDetectedCount > 0;
                return (
                  <div
                    key={dvir.id}
                    className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] shadow-xl hover:border-slate-600 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFE500]/15 text-[#FFE500] border border-[#FFE500]/30">
                          {dvir.inspectionType}
                        </span>
                        <h4 className="text-sm font-bold text-white">{dvir.dvirNumber}</h4>
                        {dvir.isScannedPaperUpload && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">document_scanner</span>
                            SCANNED HARDCOPY
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            !hasDefects
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : dvir.defectsCorrected
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-red-500/20 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {!hasDefects
                            ? '✔ NO DEFECTS // CONDITION SATISFACTORY'
                            : dvir.defectsCorrected
                            ? '✔ DEFECTS CORRECTED'
                            : '⚠ OUT OF SERVICE'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400">
                        Date: <span className="text-slate-200">{dvir.formattedDate}</span> &bull; Unit:{' '}
                        <span className="text-[#FFE500]">{dvir.truckUnit}</span> / Trailer:{' '}
                        <span className="text-slate-200">{dvir.trailerUnit}</span> &bull; Odometer:{' '}
                        <span className="text-slate-200">{dvir.odometerMiles.toLocaleString()} mi</span>
                      </p>

                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>Inspector: {dvir.driverSignature}</span>
                        {dvir.mechanicSignature && (
                          <span className="text-emerald-400">&bull; Mechanic: {dvir.mechanicSignature}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedDvirForDetail(dvir);
                          setActiveTab('VIEW_DETAIL');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-200 border border-slate-700 text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#FFE500]">visibility</span>
                        <span>View Inspection</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: CREATE NEW ELECTRONIC DVIR */}
        {activeTab === 'CREATE_NEW' && (
          <form onSubmit={handleSaveElectronicDvir} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#FFE500] uppercase tracking-wider">
                Electronic Driver Vehicle Inspection Report Form (Pre-Trip / Post-Trip)
              </span>
              <button
                type="button"
                onClick={handleImportJ1939Faults}
                className="btn-tactical-yellow px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">cable</span>
                <span>Import J1939 ECM Faults</span>
              </button>
            </div>

            {/* General Vehicle Info Row */}
            <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Inspection Type
                </label>
                <select
                  value={inspectionType}
                  onChange={(e) => setInspectionType(e.target.value as any)}
                  className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                >
                  <option value="PRE_TRIP">Pre-Trip Inspection</option>
                  <option value="EN_ROUTE">En-Route Safety Check</option>
                  <option value="POST_TRIP">Post-Trip Inspection</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Power Unit / Tractor #
                </label>
                <input
                  type="text"
                  value={truckUnit}
                  onChange={(e) => setTruckUnit(e.target.value)}
                  className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Trailer Unit #
                </label>
                <input
                  type="text"
                  value={trailerUnit}
                  onChange={(e) => setTrailerUnit(e.target.value)}
                  className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Current Odometer (Miles)
                </label>
                <input
                  type="number"
                  value={odometerMiles}
                  onChange={(e) => setOdometerMiles(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                />
              </div>
            </div>

            {/* 11-Point FMCSA Vehicle Components Checklist */}
            <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] space-y-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                49 CFR § 396.11 Mandatory Commercial Components Checklist ({defectsList.length} Items)
              </span>

              <div className="space-y-2">
                {defectsList.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border transition flex items-center justify-between gap-3 ${
                      item.hasDefect
                        ? 'bg-amber-950/20 border-amber-500/50'
                        : 'bg-[#05080E] border-[#1E2532]'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{item.componentName}</span>
                        {item.j1939DtcCode && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FFE500]/20 text-[#FFE500] text-[9px] font-bold">
                            {item.j1939DtcCode}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{item.notes}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleDefect(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition cursor-pointer shrink-0 ${
                        item.hasDefect
                          ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      }`}
                    >
                      {item.hasDefect ? 'DEFECT DETECTED' : '✔ PASS (OK)'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Attestation & Signature Box */}
            <div className="bg-[#0A0F14] p-4 rounded-xl border border-primary/50 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="mechanic-attest-chk"
                  checked={isMechanicAttested}
                  onChange={(e) => setIsMechanicAttested(e.target.checked)}
                  className="w-4 h-4 accent-[#FFE500] cursor-pointer"
                />
                <label htmlFor="mechanic-attest-chk" className="text-xs font-bold text-slate-200 cursor-pointer">
                  Certified Mechanic Repair Attestation (Required if defects were flagged and corrected)
                </label>
              </div>

              {isMechanicAttested && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Mechanic Technician Name &amp; ASE ID
                    </label>
                    <input
                      type="text"
                      value={mechanicSig}
                      onChange={(e) => setMechanicSig(e.target.value)}
                      placeholder="e.g. Pete Kovacs (ASE Master Tech #4912)"
                      className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Corrective Repair Notes
                    </label>
                    <input
                      type="text"
                      value={mechanicNotes}
                      onChange={(e) => setMechanicNotes(e.target.value)}
                      placeholder="e.g. DPF regen completed; sensor harness seated."
                      className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Driver Signature Attestation
                  </label>
                  <input
                    type="text"
                    value={driverSig}
                    onChange={(e) => setDriverSig(e.target.value)}
                    className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="btn-tactical-yellow w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(255,229,0,0.4)]"
                  >
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>Sign &amp; Archive DVIR to Vault</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* TAB 3: SCAN & UPLOAD PAPER DVIR */}
        {activeTab === 'SCAN_UPLOAD' && (
          <form onSubmit={handleSaveScannedDvir} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#FFE500] uppercase tracking-wider">
                Mobile Camera &amp; Hardcopy Document Scanner (Paper DVIR / CVSA Receipt)
              </span>
              <span className="text-[11px] text-slate-400">49 CFR § 390.31 Electronic Retention</span>
            </div>

            {/* Viewfinder / Upload Box */}
            <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] space-y-3 text-center">
              {scannedImageDataUrl ? (
                <div className="space-y-3">
                  <div className="max-h-72 overflow-hidden rounded-xl border-2 border-emerald-500/50 flex items-center justify-center bg-black">
                    <img
                      src={scannedImageDataUrl}
                      alt="Scanned DVIR"
                      className="max-h-72 object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setScannedImageDataUrl(null)}
                      className="px-3.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-white text-xs font-bold cursor-pointer"
                    >
                      Retake / Re-upload
                    </button>
                  </div>
                </div>
              ) : cameraActive ? (
                <div className="space-y-3">
                  <div className="relative max-h-72 overflow-hidden rounded-xl border-2 border-[#FFE500] bg-black">
                    <video ref={videoRef} autoPlay playsInline className="w-full max-h-72 object-cover" />
                    <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-[#FFE500]/60 m-4 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-[#FFE500] bg-black/60 px-2 py-1 rounded">
                        Align Paper DVIR within Border
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCaptureSnapshot}
                    className="btn-tactical-yellow px-6 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                    <span>Capture DVIR Snapshot</span>
                  </button>
                </div>
              ) : (
                <div className="py-8 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#FFE500]/15 border border-[#FFE500]/40 flex items-center justify-center text-[#FFE500] mx-auto">
                    <span className="material-symbols-outlined text-[32px]">document_scanner</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase">Photograph or Upload Paper DVIR</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      Converts physical paper inspection sheets, DOT roadside inspection reports, or repair orders into compliant SHA-256 sealed digital documents.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleStartCamera}
                      className="btn-tactical-yellow px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                      <span>Launch In-Cab Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-[#141C2B] hover:bg-[#1E293F] text-slate-200 border border-slate-700 text-xs font-bold uppercase transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#FFE500]">file_upload</span>
                      <span>Upload Document Image</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Metadata Fields for Scanned Document */}
            <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Power Unit / Tractor #
                </label>
                <input
                  type="text"
                  value={scanTruckUnit}
                  onChange={(e) => setScanTruckUnit(e.target.value)}
                  className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Trailer Unit #
                </label>
                <input
                  type="text"
                  value={scanTrailerUnit}
                  onChange={(e) => setScanTrailerUnit(e.target.value)}
                  className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Odometer at Inspection
                </label>
                <input
                  type="number"
                  value={scanOdometer}
                  onChange={(e) => setScanOdometer(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Inspection Notes &amp; Mechanic Stamp
                </label>
                <input
                  type="text"
                  value={scanNotes}
                  onChange={(e) => setScanNotes(e.target.value)}
                  className="w-full bg-[#05080E] border border-[#1E2532] text-xs text-white rounded-lg p-2 focus:border-[#FFE500] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={!scannedImageDataUrl}
                className={`py-3 px-6 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition cursor-pointer ${
                  scannedImageDataUrl
                    ? 'btn-tactical-yellow shadow-[0_0_15px_rgba(255,229,0,0.4)]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>Seal &amp; Deposit into Federal Document Vault</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: VIEW DETAIL OF EXISTING DVIR */}
        {activeTab === 'VIEW_DETAIL' && selectedDvirForDetail && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveTab('LIST')}
                className="text-xs font-bold text-[#FFE500] flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Back to DVIR Archive</span>
              </button>
              <span className="text-xs font-bold text-white">{selectedDvirForDetail.dvirNumber}</span>
            </div>

            <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">INSPECTION TYPE</span>
                <span className="text-xs font-bold text-white">{selectedDvirForDetail.inspectionType}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">DATE &amp; TIME</span>
                <span className="text-xs font-bold text-white">{selectedDvirForDetail.formattedDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">UNITS</span>
                <span className="text-xs font-bold text-white">
                  Tractor: {selectedDvirForDetail.truckUnit} / TRL: {selectedDvirForDetail.trailerUnit}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">ODOMETER</span>
                <span className="text-xs font-bold text-white">{selectedDvirForDetail.odometerMiles.toLocaleString()} mi</span>
              </div>
            </div>

            {selectedDvirForDetail.scannedDocumentUrl && (
              <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] space-y-2">
                <span className="text-xs font-bold text-white uppercase block">Scanned Document Image</span>
                <img
                  src={selectedDvirForDetail.scannedDocumentUrl}
                  alt="Scanned DVIR Hardcopy"
                  className="max-h-80 object-contain rounded-lg border border-slate-700 mx-auto"
                />
              </div>
            )}

            <div className="bg-[#0A0F14] p-4 rounded-xl border border-[#1E2532] space-y-2">
              <span className="text-xs font-bold text-white uppercase block">
                Component Checklist Results ({selectedDvirForDetail.defects.length} Items)
              </span>
              <div className="space-y-1.5">
                {selectedDvirForDetail.defects.map((def) => (
                  <div key={def.id} className="p-2.5 rounded-lg bg-[#05080E] border border-[#1E2532] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{def.componentName}</span>
                      <p className="text-[11px] text-slate-400">{def.notes}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      def.hasDefect ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {def.hasDefect ? 'DEFECT NOTED' : 'PASS'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0A0F14] p-4 rounded-xl border border-emerald-500/50 space-y-1.5 text-xs">
              <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                Tamper-Evident SHA-256 Merkle Proof Attestation
              </span>
              <span className="font-mono text-slate-300 break-all">{selectedDvirForDetail.merkleProofHash}</span>
              <p className="text-[11px] text-slate-400 pt-1">
                Driver Signature: {selectedDvirForDetail.driverSignature} &bull; Safe to Operate: {selectedDvirForDetail.certifiedSafeToOperate ? 'YES' : 'NO'}
              </p>
            </div>
          </div>
        )}

        {/* FOOTER BAR */}
        <div className="p-3 bg-[#0A0F14] border-t border-[#1E2532] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>FMCSA 49 CFR § 396.11 Certified Electronic Records Subsystem</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-white font-bold cursor-pointer"
          >
            Close DVIR Console
          </button>
        </div>
      </div>
    </div>
  );
};
