// src/app/components/approval-list/approval-list.ts
import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApprovalService } from '../../services/approval';
import { ApprovalRequest, ApprovalFilters } from '../../models/approval.model';

@Component({
  selector: 'app-approval-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './approval-list.html',
  styleUrls: ['./approval-list.css']
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
    status: undefined,
    priority: undefined,
    category: undefined,
    search: undefined
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
      status: undefined,
      priority: undefined,
      category: undefined,
      search: undefined
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