import { DotDocumentRecord, DotDocCategory, DotDocStatus } from '../types';
import { INITIAL_DOT_DOCUMENTS } from '../data/dotDocumentTemplatesData';

type Listener = (docs: DotDocumentRecord[]) => void;

class DotDocumentsService {
  private documents: DotDocumentRecord[];
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.documents = [...INITIAL_DOT_DOCUMENTS];
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

  public addDocument(doc: Omit<DotDocumentRecord, 'id' | 'merkleProofHash'>): DotDocumentRecord {
    // Generate SHA-256 style hash
    const randomHex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const newDoc: DotDocumentRecord = {
      ...doc,
      id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      merkleProofHash: randomHex,
    };

    this.documents = [newDoc, ...this.documents];
    this.notifyListeners();
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
    const dossier = {
      timestamp: new Date().toISOString(),
      carrier: 'Morrishive Logistics (USDOT #3928110 / MC-1489201-Z)',
      assignedDriver: 'Jonathan Vance (CDL IL-98104820)',
      totalRecords: this.documents.length,
      auditReadinessStats: this.getAuditReadinessStats(),
      documents: this.documents,
    };
    return JSON.stringify(dossier, null, 2);
  }
}

export const dotDocumentsService = new DotDocumentsService();
