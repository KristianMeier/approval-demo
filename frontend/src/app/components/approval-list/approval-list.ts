import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { ApprovalService } from '../services/approval';
import { ApprovalRequest, ApprovalFilters } from '../models/approval.model';

@Component({
  selector: 'app-approval-list',
  template: `
    <div class="approval-list">
      
      <!-- Filters -->
      <div class="filters-container">
        <div class="filters-row">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select [(ngModel)]="filters.status" (change)="onFilterChange()" class="form-control">
              <option value="">Alle statuser</option>
              <option value="pending">Afventer</option>
              <option value="approved">Godkendt</option>
              <option value="rejected">Afvist</option>
              <option value="escalated">Eskaleret</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Prioritet</label>
            <select [(ngModel)]="filters.priority" (change)="onFilterChange()" class="form-control">
              <option value="">Alle prioriteter</option>
              <option value="urgent">Akut</option>
              <option value="high">Høj</option>
              <option value="medium">Mellem</option>
              <option value="low">Lav</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select [(ngModel)]="filters.category" (change)="onFilterChange()" class="form-control">
              <option value="">Alle kategorier</option>
              <option value="IT">IT & Teknologi</option>
              <option value="Indkøb">Indkøb</option>
              <option value="HR">Personal & HR</option>
              <option value="Økonomi">Økonomi</option>
              <option value="Drift">Drift & Vedligeholdelse</option>
              <option value="Andet">Andet</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Søg</label>
            <input 
              type="text" 
              [(ngModel)]="filters.search" 
              (input)="onSearchChange()"
              placeholder="Søg i titel, beskrivelse..."
              class="form-control">
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div *ngIf="loading" class="loading">
        <div class="spinner"></div>
        <p>Indlæser anmodninger...</p>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading && requests.length === 0" class="card">
        <div class="card-body text-center">
          <h3>📭 Ingen anmodninger fundet</h3>
          <p>Der er ingen godkendelsesanmodninger der matcher dine filtre.</p>
          <button class="btn btn-primary" (click)="clearFilters()">
            🔄 Nulstil filtre
          </button>
        </div>
      </div>

      <!-- Approval requests grid -->
      <div class="approval-grid" *ngIf="!loading && requests.length > 0">
        <div *ngFor="let request of requests" 
             class="card approval-card" 
             [class]="'priority-' + request.priority"
             [class.overdue]="isOverdue(request.due_date)">
          
          <!-- Card Header -->
          <div class="card-header">
            <div class="header-main">
              <h3 class="card-title">{{ request.title }}</h3>
              <small class="reference-number">{{ request.reference_number }}</small>
            </div>
            <div class="header-actions">
              <span class="badge" [class]="'badge-' + request.status">
                {{ getStatusText(request.status) }}
              </span>
              <span class="badge priority-badge" [class]="'priority-' + request.priority">
                {{ getPriorityText(request.priority) }}
              </span>
            </div>
          </div>

          <!-- Card Body -->
          <div class="card-body">
            <p class="description">{{ request.description }}</p>

            <!-- Request Details Grid -->
            <div class="details-grid">
              <div class="detail-item">
                <strong>👤 Anmoder:</strong>
                <span>{{ request.requester.name }}</span>
              </div>
              <div class="detail-item">
                <strong>✅ Godkender:</strong>
                <span>{{ request.approver.name }}</span>
              </div>
              <div class="detail-item">
                <strong>📁 Kategori:</strong>
                <span>{{ getCategoryText(request.category) }}</span>
              </div>
              <div class="detail-item" *ngIf="request.amount">
                <strong>💰 Beløb:</strong>
                <span>{{ formatAmount(request.amount) }}</span>
              </div>
              <div class="detail-item">
                <strong>📅 Oprettet:</strong>
                <span>{{ request.created_at | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <div class="detail-item" *ngIf="request.due_date">
                <strong>⏰ Frist:</strong>
                <span [class.overdue-text]="isOverdue(request.due_date)">
                  {{ request.due_date | date:'dd/MM/yyyy' }}
                  <span *ngIf="isOverdue(request.due_date)" class="overdue-badge">
                    ({{ calculateDaysOverdue(request.due_date) }} dage forsinket)
                  </span>
                </span>
              </div>
            </div>

            <!-- Comments preview -->
            <div *ngIf="request.comments && request.comments.length > 0" class="comments-preview">
              <strong>💬 Seneste kommentar:</strong>
              <div class="comment-item">
                <small>{{ request.comments[request.comments.length - 1].user.name }} - 
                  {{ request.comments[request.comments.length - 1].created_at | date:'dd/MM HH:mm' }}</small>
                <p>{{ request.comments[request.comments.length - 1].content }}</p>
              </div>
            </div>
          </div>

          <!-- Card Footer with Actions -->
          <div class="card-footer" *ngIf="request.status === 'pending'">
            <div class="action-buttons">
              <button 
                (click)="updateRequest(request.id, 'approved')" 
                class="btn btn-success btn-sm"
                [disabled]="updating === request.id">
                <span *ngIf="updating === request.id">⏳</span>
                <span *ngIf="updating !== request.id">✅</span>
                Godkend
              </button>
              
              <button 
                (click)="updateRequest(request.id, 'rejected')" 
                class="btn btn-danger btn-sm"
                [disabled]="updating === request.id">
                <span *ngIf="updating === request.id">⏳</span>
                <span *ngIf="updating !== request.id">❌</span>
                Afvis
              </button>

              <button 
                (click)="showCommentDialog(request)" 
                class="btn btn-secondary btn-sm">
                💬 Kommentar
              </button>
            </div>
          </div>

          <!-- Escalated status info -->
          <div class="card-footer" *ngIf="request.status === 'escalated'">
            <div class="alert alert-warning">
              ⚠️ Denne anmodning er blevet eskaleret og afventer handling fra højere niveau.
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination-container" *ngIf="!loading && totalRequests > requests.length">
        <div class="pagination-info">
          Viser {{ requests.length }} af {{ totalRequests }} anmodninger
        </div>
        <button 
          class="btn btn-primary" 
          (click)="loadMore()"
          [disabled]="loadingMore">
          <span *ngIf="loadingMore">⏳ Indlæser...</span>
          <span *ngIf="!loadingMore">📄 Indlæs flere</span>
        </button>
      </div>

    </div>

    <!-- Comment Dialog -->
    <div class="modal-overlay" *ngIf="showingCommentDialog" (click)="closeCommentDialog()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>💬 Tilføj Kommentar</h3>
          <button class="btn btn-sm btn-secondary" (click)="closeCommentDialog()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Kommentar til: {{ selectedRequest?.title }}</label>
            <textarea 
              [(ngModel)]="commentText" 
              class="form-control" 
              rows="4"
              placeholder="Skriv din kommentar her..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeCommentDialog()">Annuller</button>
          <button class="btn btn-primary" (click)="addComment()" [disabled]="!commentText.trim()">
            💬 Tilføj Kommentar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .approval-list {
      width: 100%;
    }

    .filters-container {
      margin-bottom: 20px;
    }

    .filters-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      align-items: end;
    }

    .approval-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
    }

    .approval-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .approval-card.overdue {
      border-left: 6px solid #dc3545;
      background: linear-gradient(90deg, rgba(220, 53, 69, 0.1) 0%, transparent 20%);
    }

    .header-main {
      flex: 1;
    }

    .header-actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: end;
    }

    .reference-number {
      color: #666;
      font-size: 0.8rem;
      font-family: monospace;
    }

    .priority-badge {
      font-size: 0.7rem;
      padding: 2px 8px;
    }

    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .detail-item strong {
      font-size: 0.8rem;
      color: #666;
    }

    .description {
      color: #555;
      margin-bottom: 16px;
      line-height: 1.5;
    }

    .comments-preview {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      margin-top: 16px;
    }

    .comment-item {
      margin-top: 8px;
    }

    .comment-item small {
      color: #666;
      font-size: 0.8rem;
    }

    .comment-item p {
      margin: 4px 0 0 0;
      font-size: 0.9rem;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .overdue-text {
      color: #dc3545;
      font-weight: 600;
    }

    .overdue-badge {
      background: #dc3545;
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 0.7rem;
      margin-left: 4px;
    }

    .pagination-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 30px;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .pagination-info {
      color: #666;
      font-size: 0.9rem;
    }

    /* Modal styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
    }

    .modal-header h3 {
      margin: 0;
    }

    .modal-body {
      padding: 20px;
    }

    .modal-footer {
      display: flex;
      justify-content: end;
      gap: 12px;
      padding: 20px;
      border-top: 1px solid #eee;
    }

    @media (max-width: 768px) {
      .approval-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .filters-row {
        grid-template-columns: 1fr;
      }

      .details-grid {
        grid-template-columns: 1fr;
      }

      .action-buttons {
        flex-direction: column;
      }

      .pagination-container {
        flex-direction: column;
        gap: 12px;
        text-align: center;
      }
    }
  `]
})
export class ApprovalListComponent implements OnInit {
  @Output() statusChanged = new EventEmitter<{id: number, status: string}>();

  requests: ApprovalRequest[] = [];
  totalRequests = 0;
  loading = false;
  loadingMore = false;
  updating: number | null = null;

  // Comment dialog
  showingCommentDialog = false;
  selectedRequest: ApprovalRequest | null = null;
  commentText = '';

  // Filters
  filters: ApprovalFilters = {
    skip: 0,
    limit: 12,
    status: '',
    priority: '',
    category: '',
    search: ''
  };

  private searchTimeout: any = null;

  constructor(private approvalService: ApprovalService) {}

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.loading = true;
    this.filters.skip = 0; // Reset pagination

    this.approvalService.getApprovalRequests(this.filters).subscribe({
      next: (response) => {
        this.requests = response.requests;
        this.totalRequests = response.total;
        this.loading = false;
      },
      error: (error) => {
        console.error('Fejl ved indlæsning af anmodninger:', error);
        this.loading = false;
        alert(`Fejl ved indlæsning: ${error.message}`);
      }
    });
  }

  loadMore() {
    if (!this.filters.skip) this.filters.skip = 0;
    this.filters.skip += this.filters.limit || 12;
    this.loadingMore = true;

    this.approvalService.getApprovalRequests(this.filters).subscribe({
      next: (response) => {
        this.requests = [...this.requests, ...response.requests];
        this.loadingMore = false;
      },
      error: (error) => {
        console.error('Fejl ved indlæsning af flere anmodninger:', error);
        this.loadingMore = false;
        alert(`Fejl ved indlæsning: ${error.message}`);
      }
    });
  }

  onFilterChange() {
    this.loadRequests();
  }

  onSearchChange() {
    // Debounce search to avoid too many API calls
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.loadRequests();
    }, 500);
  }

  clearFilters() {
    this.filters = {
      skip: 0,
      limit: 12,
      status: '',
      priority: '',
      category: '',
      search: ''
    };
    this.loadRequests();
  }

  updateRequest(id: number, status: 'approved' | 'rejected') {
    this.updating = id;

    const statusText = status === 'approved' ? 'godkende' : 'afvise';
    
    if (!confirm(`Er du sikker på at du vil ${statusText} denne anmodning?`)) {
      this.updating = null;
      return;
    }

    this.approvalService.updateApprovalRequest(id, { status }, 1).subscribe({
      next: (updatedRequest) => {
        // Update the request in the list
        const index = this.requests.findIndex(r => r.id === id);
        if (index >= 0) {
          this.requests[index] = updatedRequest;
        }
        
        this.updating = null;
        this.statusChanged.emit({ id, status });
        
        const successText = status === 'approved' ? 'godkendt' : 'afvist';
        alert(`✅ Anmodning ${successText} succesfuldt!`);
      },
      error: (error) => {
        console.error('Fejl ved opdatering af anmodning:', error);
        this.updating = null;
        alert(`❌ Fejl ved opdatering: ${error.message}`);
      }
    });
  }

  showCommentDialog(request: ApprovalRequest) {
    this.selectedRequest = request;
    this.commentText = '';
    this.showingCommentDialog = true;
  }

  closeCommentDialog() {
    this.showingCommentDialog = false;
    this.selectedRequest = null;
    this.commentText = '';
  }

  addComment() {
    if (!this.selectedRequest || !this.commentText.trim()) return;

    this.approvalService.addComment(
      this.selectedRequest.id, 
      this.commentText.trim(), 
      1, // Current user ID
      false // Not internal
    ).subscribe({
      next: () => {
        alert('✅ Kommentar tilføjet!');
        this.closeCommentDialog();
        // Reload the specific request to get updated comments
        this.loadRequests();
      },
      error: (error) => {
        console.error('Fejl ved tilføjelse af kommentar:', error);
        alert(`❌ Fejl ved tilføjelse af kommentar: ${error.message}`);
      }
    });
  }

  // Utility methods
  getStatusText(status: string): string {
    return this.approvalService.getStatusText(status);
  }

  getPriorityText(priority: string): string {
    return this.approvalService.getPriorityText(priority);
  }

  getCategoryText(category: string): string {
    return this.approvalService.getCategoryText(category);
  }

  formatAmount(amount: number | undefined): string {
    return this.approvalService.formatAmount(amount);
  }

  isOverdue(dueDate: string | undefined): boolean {
    return this.approvalService.isOverdue(dueDate);
  }

  calculateDaysOverdue(dueDate: string): number {
    return this.approvalService.calculateDaysOverdue(dueDate);
  }
}