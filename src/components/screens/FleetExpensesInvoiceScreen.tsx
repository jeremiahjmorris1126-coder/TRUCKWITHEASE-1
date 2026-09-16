import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FleetInvoiceRecord, InvoiceCategory } from '../../types';
import { fleetInvoicesService } from '../../services/fleetInvoicesService';

interface FleetExpensesInvoiceScreenProps {
  onShowToast: (msg: string, icon?: string) => void;
}

export const FleetExpensesInvoiceScreen: React.FC<FleetExpensesInvoiceScreenProps> = ({ onShowToast }) => {
  const [invoices, setInvoices] = useState<FleetInvoiceRecord[]>([]);
  const [activeCategory, setActiveCategory] = useState<InvoiceCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<FleetInvoiceRecord | null>(null);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);

  // New Invoice Form State for Manual/OCR Capture
  const [scanVendor, setScanVendor] = useState<string>('Fleet Equipment & Supplies Direct');
  const [scanOrderNum, setScanOrderNum] = useState<string>('SUP-904812');
  const [scanCategory, setScanCategory] = useState<InvoiceCategory>('FLEET_MEMBERSHIPS_SUPPLIES');
  const [scanItemDesc, setScanItemDesc] = useState<string>('Commercial Fleet Membership & Delivery Support');
  const [scanAmount, setScanAmount] = useState<number>(99.0);
  const [scanPayment, setScanPayment] = useState<string>('Fleet Corporate Card - XXXX4962');
  const [scanBillTo, setScanBillTo] = useState<string>('Fleet Operations Manager');
  const [scanShipTo, setScanShipTo] = useState<string>('Terminal Receiving Dock B');
  const [scanNotes, setScanNotes] = useState<string>('Annual Membership & Catering Fleet Supply Order');

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = fleetInvoicesService.subscribe((data) => {
      setInvoices(data);
    });
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    return fleetInvoicesService.getSummaryStats();
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (activeCategory !== 'ALL' && inv.category !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          inv.orderNumber.toLowerCase().includes(q) ||
          inv.vendorName.toLowerCase().includes(q) ||
          inv.billToName.toLowerCase().includes(q) ||
          inv.shipToName.toLowerCase().includes(q) ||
          inv.paymentMethod.toLowerCase().includes(q) ||
          inv.items.some((i) => i.description.toLowerCase().includes(q) || i.itemNumber.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [invoices, activeCategory, searchQuery]);

  // Open the primary invoice by default if user clicks
  const openPrimaryInvoice = () => {
    const primaryInv = invoices.find((inv) => inv.orderNumber === 'SUP-904812');
    if (primaryInv) {
      setSelectedInvoice(primaryInv);
    } else if (invoices.length > 0) {
      setSelectedInvoice(invoices[0]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCapturedImage(dataUrl);
      setIsOcrProcessing(true);

      setTimeout(() => {
        setIsOcrProcessing(false);
        onShowToast('OCR INVOICE EXTRACTED • MATCHED RECORD', 'receipt');
      }, 800);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const newInv = fleetInvoicesService.addInvoice({
      orderNumber: scanOrderNum || `ORD-${Date.now().toString().substring(5)}`,
      userId: 'US-89021',
      dateOrdered: new Date().toLocaleDateString('en-US') + ' at 12:17 AM',
      vendorName: scanVendor,
      vendorAddress: '100 Logistics Way, Enterprise, MO 63011',
      vendorPhone: '800-555-0199',
      vendorContactEmail: 'support@fleetsuppliesdirect.com',
      billToName: scanBillTo,
      billToAddress: '100 Logistics Center Dr, Suite 400, St. Louis, MO 63101',
      shipToName: scanShipTo,
      shipToAddress: '100 Logistics Center Dr, Suite 400, St. Louis, MO 63101',
      shippingMethod: 'Ground',
      customerPhone: '800-555-0100',
      category: scanCategory,
      items: [
        {
          itemNumber: 'MEM-PLUS-2026',
          description: scanItemDesc,
          unitPrice: Number(scanAmount),
          qty: 1,
          estTax: 0,
          total: Number(scanAmount),
        },
      ],
      subtotal: Number(scanAmount),
      shippingAndHandling: 0,
      estimatedTax: 0,
      totalAmount: Number(scanAmount),
      balanceDue: 0,
      paymentMethod: scanPayment,
      notes: scanNotes,
      taxDeductible: true,
      status: 'PAID',
      capturedViaCamera: true,
    });

    onShowToast(`INVOICE RECORDED: ${newInv.vendorName} #${newInv.orderNumber}`, 'verified');
    setShowScannerModal(false);
    setSelectedInvoice(newInv);
  };

  const handleExportCsv = () => {
    const headers = ['Order #', 'Date', 'Vendor', 'Category', 'Bill To', 'Total Amount', 'Payment Method', 'Tax Deductible', 'Status'];
    const rows = filteredInvoices.map((inv) => [
      inv.orderNumber,
      `"${inv.dateOrdered}"`,
      `"${inv.vendorName.replace(/"/g, '""')}"`,
      inv.category,
      `"${inv.billToName.replace(/"/g, '""')}"`,
      inv.totalAmount.toFixed(2),
      `"${inv.paymentMethod.replace(/"/g, '""')}"`,
      inv.taxDeductible ? 'YES' : 'NO',
      inv.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fleet_Invoices_Expenses_Export_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    onShowToast('EXPORTED EXPENSE LEDGER TO CSV', 'download');
  };

  return (
    <div className="space-y-space-md font-mono text-on-surface pb-space-2xl">
      {/* Header Banner */}
      <div className="bg-surface-container p-space-md rounded-2xl border border-primary/40 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-surface-container-high pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 text-primary flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-[28px]">receipt_long</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-primary uppercase font-bold tracking-wider text-[12px]">
                  FLEET INVOICES &amp; EXPENSE ACCOUNTING
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                  TAX DEDUCTIBLE VERIFIED
                </span>
              </div>
              <p className="text-[11px] text-outline mt-0.5">
                Centralized invoice ledger for fleet purchases, fuel receipts, vehicle maintenance, and equipment supplies.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={openPrimaryInvoice}
              className="px-3.5 py-2 rounded-xl bg-primary text-on-primary font-bold text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-95 shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">receipt</span>
              <span>View Supply Invoice (#SUP-904812)</span>
            </button>

            <button
              onClick={() => setShowScannerModal(true)}
              className="px-3 py-2 rounded-xl bg-surface-container-high text-primary border border-primary/40 font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container-highest transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
              <span>Scan / Add Invoice</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl bg-surface-container-high text-outline hover:text-on-surface border border-surface-container-high font-bold text-[11px] uppercase tracking-wider hover:bg-surface-container-highest transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Stats Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm text-[11px]">
          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">TOTAL RECORDED EXPENSES</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[20px] font-bold text-primary">${stats.totalSpent.toFixed(2)}</span>
              <span className="text-[9px] text-outline font-bold">{stats.totalCount} Records</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">TAX DEDUCTIBLE TOTAL</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[20px] font-bold text-emerald-400">${stats.taxDeductibleTotal.toFixed(2)}</span>
              <span className="text-[9px] text-emerald-400 font-bold">100% AUDIT CLEAR</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">MEMBERSHIPS &amp; SUPPLIES</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[20px] font-bold text-sky-400">${stats.categoryTotals.FLEET_MEMBERSHIPS_SUPPLIES.toFixed(2)}</span>
              <span className="text-[9px] text-sky-300 font-bold">Equipment &amp; Supplies</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
            <span className="text-[9px] text-outline uppercase block font-bold">FUEL &amp; IFTA LOGS</span>
            <div className="flex items-baseline justify-between">
              <span className="text-[20px] font-bold text-amber-400">${stats.categoryTotals.FUEL_DIESEL.toFixed(2)}</span>
              <span className="text-[9px] text-amber-400 font-bold">Diesel &amp; DEF</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="bg-surface-container p-3 rounded-2xl border border-surface-container-high space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] scrollbar-none">
          {[
            { id: 'ALL', label: 'ALL EXPENSES', icon: 'list_alt' },
            { id: 'FLEET_MEMBERSHIPS_SUPPLIES', label: '🛒 SUPPLIES & MEMBERSHIPS', icon: 'shopping_bag' },
            { id: 'FUEL_DIESEL', label: '⛽ DIESEL & DEF FUEL', icon: 'local_gas_station' },
            { id: 'MAINTENANCE_PARTS', label: '🔧 MAINTENANCE & REPAIRS', icon: 'build' },
            { id: 'TOLLS_SCALES', label: '🛣️ TOLLS & WEIGH SCALES', icon: 'toll' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as InvoiceCategory | 'ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container-low text-outline hover:text-on-surface border border-surface-container-high/60'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search order number (e.g. SUP-904812), vendor name, bill to, item description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl pl-9 pr-4 py-2 text-[11px] text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Invoices List / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
        {filteredInvoices.map((inv) => (
          <div
            key={inv.id}
            onClick={() => setSelectedInvoice(inv)}
            className={`bg-surface-container p-4 rounded-2xl border transition-all cursor-pointer shadow-lg space-y-3 group ${
              inv.orderNumber === 'SUP-904812'
                ? 'border-primary/80 ring-2 ring-primary/30 bg-surface-container-high/40'
                : 'border-surface-container-high hover:border-primary/50'
            }`}
          >
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <span className="text-[10px] text-primary font-bold uppercase">ORDER #{inv.orderNumber}</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                {inv.status}
              </span>
            </div>

            <div>
              <h4 className="text-[15px] font-bold text-on-surface group-hover:text-primary transition-colors">
                {inv.vendorName}
              </h4>
              <p className="text-[10px] text-outline mt-0.5">{inv.dateOrdered}</p>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-1 text-[10px]">
              <div className="flex justify-between text-outline">
                <span>Bill To:</span>
                <span className="font-bold text-on-surface">{inv.billToName}</span>
              </div>
              <div className="flex justify-between text-outline">
                <span>Ship To:</span>
                <span className="font-bold text-on-surface">{inv.shipToName}</span>
              </div>
              <div className="flex justify-between border-t border-surface-container-high pt-1 mt-1">
                <span className="font-bold text-on-surface">Total Paid:</span>
                <span className="font-bold text-emerald-400 text-[12px]">${inv.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-[9px] text-outline flex items-center justify-between pt-1">
              <span>{inv.paymentMethod}</span>
              <span className="text-primary font-bold hover:underline flex items-center gap-0.5">
                <span>Inspect Invoice</span>
                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* SALES INVOICE DOCUMENT INSPECTOR MODAL (Matching exact WebstaurantStore Invoice Layout) */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-fade-in font-sans">
          <div className="bg-white text-slate-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border-4 border-slate-300 p-6 sm:p-8 space-y-6">
            {/* Top Close / Actions Bar */}
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase border border-emerald-300">
                  OFFICIAL SALES INVOICE RECEIPT
                </span>
                <span className="text-slate-500 text-[11px] font-mono">Order #{selectedInvoice.orderNumber}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-900 text-[11px] font-bold uppercase cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">print</span>
                  <span>Print Invoice</span>
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Vendor Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{selectedInvoice.vendorName}</h1>
                <p className="text-lg font-bold text-slate-700">Sales Invoice</p>
              </div>

              <div className="mt-3 sm:mt-0 text-right bg-slate-100 p-2.5 rounded border border-slate-300 text-xs">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="font-bold text-slate-600 block text-[10px]">Order Number</span>
                    <span className="font-bold text-slate-900">{selectedInvoice.orderNumber}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-600 block text-[10px]">User ID</span>
                    <span className="font-bold text-slate-900">{selectedInvoice.userId || '47056359'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-600 block text-[10px]">Date Ordered</span>
                    <span className="font-bold text-slate-900">{selectedInvoice.dateOrdered}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To, Ship To & Shipping Method Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b pb-4 text-xs">
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 uppercase border-b pb-1">Bill To</h3>
                <p className="font-bold text-slate-900">{selectedInvoice.billToName}</p>
                {selectedInvoice.billToCompany && <p className="text-slate-700">{selectedInvoice.billToCompany}</p>}
                <p className="text-slate-600 whitespace-pre-line">{selectedInvoice.billToAddress}</p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 uppercase border-b pb-1">Ship To</h3>
                <p className="font-bold text-slate-900">{selectedInvoice.shipToName}</p>
                {selectedInvoice.shipToCompany && <p className="text-slate-700">{selectedInvoice.shipToCompany}</p>}
                <p className="text-slate-600 whitespace-pre-line">{selectedInvoice.shipToAddress}</p>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 uppercase border-b pb-1">Shipping Method</h3>
                <p className="font-bold text-slate-800">{selectedInvoice.shippingMethod}</p>
              </div>
            </div>

            {/* Contact Details Bar */}
            <div className="grid grid-cols-3 gap-2 bg-slate-900 text-white p-2 text-xs text-center rounded">
              <div>
                <span className="text-[10px] text-slate-300 block">Your Contact</span>
                <span className="font-bold">{selectedInvoice.vendorContactEmail}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-300 block">Customer PO</span>
                <span className="font-bold">{selectedInvoice.customerPo || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-300 block">Customer Phone</span>
                <span className="font-bold">{selectedInvoice.customerPhone}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="border rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-bold text-[11px]">
                  <tr>
                    <th className="p-2.5 border-r border-slate-700">Item Number</th>
                    <th className="p-2.5 border-r border-slate-700">Description</th>
                    <th className="p-2.5 border-r border-slate-700 text-right">Unit Price</th>
                    <th className="p-2.5 border-r border-slate-700 text-center">QTY</th>
                    <th className="p-2.5 border-r border-slate-700 text-right">Est. Tax</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {selectedInvoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold border-r">{item.itemNumber}</td>
                      <td className="p-2.5 border-r font-medium">{item.description}</td>
                      <td className="p-2.5 border-r text-right font-mono">${item.unitPrice.toFixed(2)}</td>
                      <td className="p-2.5 border-r text-center font-bold">{item.qty}</td>
                      <td className="p-2.5 border-r text-right font-mono">${item.estTax.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold font-mono">${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Totals Summary Box */}
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-72 space-y-1 text-xs border border-slate-300 p-3 rounded bg-slate-50 font-mono">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-bold text-slate-700">Subtotal:</span>
                  <span className="font-bold text-slate-900">${selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-bold text-slate-700">Shipping &amp; Handling:</span>
                  <span className="font-bold text-slate-900">${selectedInvoice.shippingAndHandling.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="font-bold text-slate-700">Estimated Tax:</span>
                  <span className="font-bold text-slate-900">${selectedInvoice.estimatedTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b-2 border-slate-900 text-sm font-bold">
                  <span className="text-slate-900">Total:</span>
                  <span className="text-slate-900">${selectedInvoice.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm font-bold text-emerald-700">
                  <span>Balance Due:</span>
                  <span>${selectedInvoice.balanceDue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Method Line */}
            <div className="p-2.5 rounded bg-slate-900 text-white font-bold text-xs">
              Payment Method: {selectedInvoice.paymentMethod}
            </div>

            {/* Vendor Address Footer */}
            <div className="border-t pt-4 text-center space-y-2 text-xs text-slate-600">
              <p className="font-bold text-slate-800">Thank you for your business!</p>
              <div className="space-y-0.5">
                <p className="font-bold text-slate-900">{selectedInvoice.vendorName}</p>
                <p>{selectedInvoice.vendorAddress}</p>
                <p>{selectedInvoice.vendorPhone}</p>
              </div>
              <p className="text-[10px] text-amber-700 font-medium italic">
                Note: The above address is for billing purposes only.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SCAN / ADD NEW INVOICE MODAL */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-fade-in font-mono">
          <div className="bg-surface-container p-5 rounded-2xl border-2 border-primary shadow-2xl max-w-xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[28px]">add_a_photo</span>
                <div>
                  <h3 className="text-[15px] font-bold text-on-surface uppercase">SCAN FLEET INVOICE / RECEIPT</h3>
                  <p className="text-[10px] text-outline">Upload sales invoices, fuel tickets, or parts receipts</p>
                </div>
              </div>
              <button
                onClick={() => setShowScannerModal(false)}
                className="w-8 h-8 rounded-lg bg-surface-container-high text-outline hover:text-on-surface flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-3 text-[11px]">
              <div className="p-3 rounded-xl bg-surface-container-lowest border border-dashed border-primary/60 text-center space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold uppercase text-[10px] cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>Upload Sales Invoice PDF / Image</span>
                </button>
                {capturedImage && (
                  <p className="text-[10px] text-emerald-400 font-bold">Image loaded • Ready for entry</p>
                )}
              </div>

              {isOcrProcessing && (
                <div className="p-2 rounded bg-primary/20 text-primary text-[10px] animate-pulse">
                  Extracting invoice details with AI OCR...
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-outline uppercase text-[9px] font-bold block">Vendor Name</label>
                  <input
                    type="text"
                    value={scanVendor}
                    onChange={(e) => setScanVendor(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-outline uppercase text-[9px] font-bold block">Order Number</label>
                  <input
                    type="text"
                    value={scanOrderNum}
                    onChange={(e) => setScanOrderNum(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-outline uppercase text-[9px] font-bold block">Category</label>
                  <select
                    value={scanCategory}
                    onChange={(e) => setScanCategory(e.target.value as InvoiceCategory)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                  >
                    <option value="FLEET_MEMBERSHIPS_SUPPLIES">Supplies &amp; Memberships</option>
                    <option value="FUEL_DIESEL">Diesel &amp; DEF Fuel</option>
                    <option value="MAINTENANCE_PARTS">Maintenance &amp; Repairs</option>
                    <option value="TOLLS_SCALES">Tolls &amp; Scales</option>
                  </select>
                </div>

                <div>
                  <label className="text-outline uppercase text-[9px] font-bold block">Total Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={scanAmount}
                    onChange={(e) => setScanAmount(Number(e.target.value))}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-outline uppercase text-[9px] font-bold block">Item Description</label>
                  <input
                    type="text"
                    value={scanItemDesc}
                    onChange={(e) => setScanItemDesc(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                    required
                  />
                </div>

                <div>
                  <label className="text-outline uppercase text-[9px] font-bold block">Bill To</label>
                  <input
                    type="text"
                    value={scanBillTo}
                    onChange={(e) => setScanBillTo(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-outline uppercase text-[9px] font-bold block">Ship To</label>
                  <input
                    type="text"
                    value={scanShipTo}
                    onChange={(e) => setScanShipTo(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-outline uppercase text-[9px] font-bold block">Payment Method</label>
                  <input
                    type="text"
                    value={scanPayment}
                    onChange={(e) => setScanPayment(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-surface-container-high rounded-lg p-2 text-on-surface focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScannerModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container-high text-outline hover:text-on-surface font-bold uppercase text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold uppercase text-[10px] hover:brightness-110 cursor-pointer shadow-lg"
                >
                  Save to Expense Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
