import { DotDocumentRecord, DotDocCategory, DotDocStatus } from '../types';
import { generateSecureToken, computeSha256 } from './cryptoService';
import { authenticatedFetch, getSubscriberSession } from './firebaseClientAuth';

type Listener = (docs: DotDocumentRecord[]) => void;

function mapCategoryToBackendType(category: DotDocCategory, title: string): 'CDL' | 'MEDICAL_CARD' | 'BOL' | 'RATE_CON' | 'IFTA_RECEIPT' | 'DVIR' {
  const lower = title.toLowerCase();
  if (lower.includes('cdl') || lower.includes('license')) return 'CDL';
  if (lower.includes('medical') || lower.includes('physician') || lower.includes('mcsa-5876') || category === 'DRUG_ALCOHOL') return 'MEDICAL_CARD';
  if (lower.includes('bill of lading') || lower.includes('bol') || category === 'HAZMAT_SAFETY') return 'BOL';
  if (lower.includes('rate') || lower.includes('operating') || category === 'FLEET_INSURANCE') return 'RATE_CON';
  if (lower.includes('ifta') || lower.includes('fuel')) return 'IFTA_RECEIPT';
  return 'DVIR';
}

class DotDocumentsService {
  private documents: DotDocumentRecord[];
  private listeners: Set<Listener> = new Set();
  private isSyncingBackend: boolean = false;

  constructor() {
    this.documents = [];
    if (typeof window !== 'undefined') {
      this.syncWithBackend().catch(() => {});
    }
  }

  public getDocuments(): DotDocumentRecord[] {
    return [...this.documents];
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getDocuments());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const docs = this.getDocuments();
    this.listeners.forEach((listener) => {
      try {
        listener(docs);
      } catch (err) {
        console.error('Error in DotDocumentsService listener:', err);
      }
    });
  }

  public async syncWithBackend(): Promise<void> {
    if (this.isSyncingBackend) return;
    this.isSyncingBackend = true;
    try {
      const res = await authenticatedFetch('/api/driver/documents');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.documents)) {
          const session = getSubscriberSession();
          const primaryDriver = session?.user?.name || '';
          const backendDocs: DotDocumentRecord[] = data.documents.map((d: any): DotDocumentRecord => ({
            id: d.id,
            documentTitle: d.title || 'Official Compliance Document',
            category: (d.type === 'CDL' || d.type === 'MEDICAL_CARD') ? 'DRIVER_DQF' : (d.type === 'DVIR' ? 'VEHICLE_DVIR' : 'FLEET_INSURANCE'),
            cfrReference: d.type === 'CDL' ? '49 CFR § 383.23' : (d.type === 'MEDICAL_CARD' ? '49 CFR § 391.43' : '49 CFR § 390.31'),
            documentNumber: d.id,
            driverName: d.driverName || primaryDriver,
            unitNumber: d.unitNumber || '',
            issuingAuthority: 'Fleet Document Repository',
            issuedDate: d.uploadedAt ? d.uploadedAt.substring(0, 10) : new Date().toISOString().substring(0, 10),
            expirationDate: d.expirationDate || '',
            status: d.status === 'EXPIRED' ? 'EXPIRED' : (d.status === 'PENDING' ? 'EXPIRING_SOON' : 'VALID'),
            documentHash: d.documentHash || generateSecureToken(32),
            fileSizeBytes: d.fileSizeBytes || 0,
            fileFormat: d.fileFormat || 'PDF',
            notes: `Backend repository record [${d.type}]`,
            certified: d.status === 'VERIFIED',
          }));

          this.documents = backendDocs;
          this.notifyListeners();
        }
      }
    } catch {
      // offline fallback retained
    } finally {
      this.isSyncingBackend = false;
    }
  }

  public filterByCategory(category: DotDocCategory | 'ALL'): DotDocumentRecord[] {
    if (category === 'ALL') return this.getDocuments();
    return this.documents.filter((doc) => doc.category === category);
  }

  public filterByStatus(status: DotDocStatus | 'ALL'): DotDocumentRecord[] {
    if (status === 'ALL') return this.getDocuments();
    return this.documents.filter((doc) => doc.status === status);
  }

  public getAuditReadinessStats() {
    const total = this.documents.length;
    const valid = this.documents.filter((d) => d.status === 'VALID').length;
    const expiring = this.documents.filter((d) => d.status === 'EXPIRING_SOON').length;
    const expired = this.documents.filter((d) => d.status === 'EXPIRED').length;
    const score = total > 0 ? Math.round(((valid + expiring * 0.5) / total) * 100) : 100;

    return {
      total,
      valid,
      expiring,
      expired,
      score,
    };
  }

  public addDocument(doc: Omit<DotDocumentRecord, 'id' | 'documentHash'>): DotDocumentRecord {
    const randomHex = generateSecureToken(32);
    const newDocId = `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newDoc: DotDocumentRecord = {
      ...doc,
      id: newDocId,
      documentHash: randomHex,
    };

    this.documents = [newDoc, ...this.documents];
    this.notifyListeners();

    // Async computation of genuine SHA-256 document hash and backend persistence
    const digestPayload = `${newDoc.documentTitle}::${newDoc.documentNumber}::${newDoc.cfrReference}::${newDoc.issuedDate}::${newDoc.expirationDate}`;
    computeSha256(digestPayload).then((exactSha256) => {
      const idx = this.documents.findIndex((d) => d.id === newDocId);
      if (idx !== -1) {
        this.documents[idx].documentHash = exactSha256;
        this.notifyListeners();
      }

      authenticatedFetch('/api/driver/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mapCategoryToBackendType(newDoc.category, newDoc.documentTitle),
          title: newDoc.documentTitle,
          fileUrl: `/vault/docs/${newDocId}.pdf`,
          status: newDoc.status === 'VALID' ? 'VERIFIED' : 'PENDING',
        }),
      }).catch(() => {});
    }).catch(() => {});

    return newDoc;
  }

  public renewDocument(docId: string, newExpirationDate: string, notes?: string): DotDocumentRecord | null {
    const index = this.documents.findIndex((d) => d.id === docId);
    if (index === -1) return null;

    const target = this.documents[index];
    const updated: DotDocumentRecord = {
      ...target,
      issuedDate: new Date().toISOString().substring(0, 10),
      expirationDate: newExpirationDate,
      status: 'VALID',
      notes: notes ? `${target.notes} | RENEWED: ${notes}` : target.notes,
      certified: true,
    };

    this.documents[index] = updated;
    this.notifyListeners();

    // Compute updated document hash and dispatch to backend
    const digestPayload = `RENEWAL::${updated.id}::${updated.documentTitle}::${updated.expirationDate}`;
    computeSha256(digestPayload).then((exactSha256) => {
      const idx = this.documents.findIndex((d) => d.id === docId);
      if (idx !== -1) {
        this.documents[idx].documentHash = exactSha256;
        this.notifyListeners();
      }

      authenticatedFetch('/api/driver/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mapCategoryToBackendType(updated.category, updated.documentTitle),
          title: `Renewed: ${updated.documentTitle}`,
          fileUrl: `/vault/renewals/${updated.id}.pdf`,
          status: 'VERIFIED',
        }),
      }).catch(() => {});
    }).catch(() => {});

    return updated;
  }

  public deleteDocument(docId: string): boolean {
    const initialLen = this.documents.length;
    this.documents = this.documents.filter((d) => d.id !== docId);
    if (this.documents.length !== initialLen) {
      this.notifyListeners();
      return true;
    }
    return false;
  }

  public exportFullAuditDossierJSON(): string {
    const session = getSubscriberSession();
    const carrier = session?.user?.carrierName
      ? `${session.user.carrierName} (USDOT #${session.user.usdotNumber || ''} / MC-${session.user.mcNumber || ''})`
      : '';
    const assignedDriver = session?.user?.name || '';

    const dossier = {
      timestamp: new Date().toISOString(),
      carrier,
      assignedDriver,
      totalRecords: this.documents.length,
      auditReadinessStats: this.getAuditReadinessStats(),
      documents: this.documents,
    };
    return JSON.stringify(dossier, null, 2);
  }
}

export const dotDocumentsService = new DotDocumentsService();
