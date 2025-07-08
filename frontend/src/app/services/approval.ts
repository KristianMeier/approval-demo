import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { 
  ApprovalRequest, 
  CreateApprovalRequest, 
  UpdateApprovalRequest,
  User, 
  ApprovalRequestList,
  ApprovalStats,
  SystemHealth,
  WebSocketStats,
  ApprovalFilters
} from '../models/approval.model';

@Injectable({
  providedIn: 'root'
})
export class ApprovalService {
  private apiUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  // Error handling
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Der opstod en ukendt fejl';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Klient fejl: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 400:
          errorMessage = 'Ugyldig anmodning - kontroller dine data';
          break;
        case 401:
          errorMessage = 'Ikke autoriseret - log ind igen';
          break;
        case 403:
          errorMessage = 'Ikke tilladelse til denne handling';
          break;
        case 404:
          errorMessage = 'Ressource ikke fundet';
          break;
        case 422:
          errorMessage = error.error?.detail || 'Valideringsfejl';
          break;
        case 500:
          errorMessage = 'Intern serverfejl - kontakt support';
          break;
        case 503:
          errorMessage = 'Service utilgængelig - prøv igen senere';
          break;
        default:
          errorMessage = `Server fejl: ${error.status} - ${error.error?.detail || error.message}`;
      }
    }
    
    console.error('API fejl:', error);
    return throwError(() => new Error(errorMessage));
  }

  // System endpoints
  getSystemHealth(): Observable<SystemHealth> {
    return this.http.get<SystemHealth>(`${this.apiUrl}/health`)
      .pipe(
        retry(2),
        catchError(this.handleError)
      );
  }

  getWebSocketStats(): Observable<WebSocketStats> {
    return this.http.get<WebSocketStats>(`${this.apiUrl}/stats/websocket`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getApprovalStats(days: number = 30): Observable<ApprovalStats> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<ApprovalStats>(`${this.apiUrl}/stats/`, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  // User endpoints
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users/`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createUser(user: Omit<User, 'id' | 'created_at' | 'is_active' | 'last_login'>): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users/`, user)
      .pipe(
        catchError(this.handleError)
      );
  }

  createTestUsers(): Observable<any> {
    const testUsers = [
      {
        email: 'manager@gov.dk',
        name: 'Manager Jensen',
        role: 'Manager',
        department: 'Administration'
      },
      {
        email: 'employee@gov.dk',
        name: 'Medarbejder Hansen',
        role: 'Employee',
        department: 'IT'
      }
    ];

    // Create both users
    const requests = testUsers.map(user => this.createUser(user));
    
    // Return a combined observable (simplified for demo)
    return this.createUser(testUsers[0]);
  }

  // Approval Request endpoints
  getApprovalRequests(filters?: ApprovalFilters): Observable<ApprovalRequestList> {
    let params = new HttpParams();
    
    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = filters[key as keyof ApprovalFilters];
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }
    
    return this.http.get<ApprovalRequestList>(`${this.apiUrl}/approval-requests/`, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  getApprovalRequest(id: number): Observable<ApprovalRequest> {
    return this.http.get<ApprovalRequest>(`${this.apiUrl}/approval-requests/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createApprovalRequest(request: CreateApprovalRequest, requesterId: number): Observable<ApprovalRequest> {
    const params = new HttpParams().set('requester_id', requesterId.toString());
    return this.http.post<ApprovalRequest>(`${this.apiUrl}/approval-requests/`, request, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  updateApprovalRequest(
    id: number, 
    update: UpdateApprovalRequest, 
    userId: number
  ): Observable<ApprovalRequest> {
    const params = new HttpParams().set('user_id', userId.toString());
    return this.http.put<ApprovalRequest>(`${this.apiUrl}/approval-requests/${id}`, update, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Comment endpoints
  addComment(requestId: number, content: string, userId: number, isInternal: boolean = false): Observable<any> {
    const params = new HttpParams()
      .set('content', content)
      .set('user_id', userId.toString())
      .set('is_internal', isInternal.toString());
    
    return this.http.post(`${this.apiUrl}/approval-requests/${requestId}/comments`, null, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Utility methods
  getPriorityText(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'low': 'Lav',
      'medium': 'Mellem',
      'high': 'Høj',
      'urgent': 'Akut'
    };
    return priorityMap[priority] || priority;
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Afventer',
      'approved': 'Godkendt',
      'rejected': 'Afvist',
      'escalated': 'Eskaleret',
      'cancelled': 'Annulleret'
    };
    return statusMap[status] || status;
  }

  getCategoryText(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'IT': 'IT & Teknologi',
      'Indkøb': 'Indkøb & Procurement',
      'HR': 'Personal & HR',
      'Økonomi': 'Økonomi & Budget',
      'Drift': 'Drift & Vedligeholdelse',
      'Andet': 'Andet'
    };
    return categoryMap[category] || category;
  }

  formatAmount(amount: number | undefined, currency: string = 'DKK'): string {
    if (!amount) return '';
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  calculateDaysOverdue(dueDate: string): number {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = now.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isOverdue(dueDate: string | undefined): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }
}
