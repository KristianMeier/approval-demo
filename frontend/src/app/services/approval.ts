// src/app/services/approval.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, retry, map } from 'rxjs/operators';
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

// Import mock data
import mockData from '../../assets/mock-data.json';

@Injectable({
  providedIn: 'root'
})
export class ApprovalService {
  private apiUrl = 'http://localhost:8000';
  private useMockData = false;

  constructor(private http: HttpClient) {
    // Check if backend is available on service initialization
    this.checkBackendAvailability();
  }

  private checkBackendAvailability() {
    this.http.get(`${this.apiUrl}/health`).subscribe({
      next: () => {
        this.useMockData = false;
        console.log('✅ Backend er tilgængelig');
      },
      error: () => {
        this.useMockData = true;
        console.warn('⚠️ Backend ikke tilgængelig - bruger mock data');
      }
    });
  }

  // Error handling
  private handleError(error: HttpErrorResponse) {
    // If backend is not available, switch to mock data
    if (error.status === 0 || error.status === 504) {
      this.useMockData = true;
      console.warn('⚠️ Skifter til mock data pga. netværksfejl');
      return throwError(() => new Error('Backend ikke tilgængelig - bruger mock data'));
    }

    let errorMessage = 'Der opstod en ukendt fejl';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Klient fejl: ${error.error.message}`;
    } else {
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
    if (this.useMockData) {
      return of(mockData.systemHealth as SystemHealth);
    }

    return this.http.get<SystemHealth>(`${this.apiUrl}/health`)
      .pipe(
        retry(1),
        catchError((error) => {
          this.useMockData = true;
          return of(mockData.systemHealth as SystemHealth);
        })
      );
  }

  getWebSocketStats(): Observable<WebSocketStats> {
    if (this.useMockData) {
      return of(mockData.websocketStats as WebSocketStats);
    }

    return this.http.get<WebSocketStats>(`${this.apiUrl}/stats/websocket`)
      .pipe(
        catchError((error) => {
          return of(mockData.websocketStats as WebSocketStats);
        })
      );
  }

  getApprovalStats(days: number = 30): Observable<ApprovalStats> {
    if (this.useMockData) {
      return of(mockData.approvalStats as ApprovalStats);
    }

    const params = new HttpParams().set('days', days.toString());
    return this.http.get<ApprovalStats>(`${this.apiUrl}/stats/`, { params })
      .pipe(
        catchError((error) => {
          return of(mockData.approvalStats as ApprovalStats);
        })
      );
  }

  // User endpoints
  getUsers(): Observable<User[]> {
    if (this.useMockData) {
      return of(mockData.users as User[]);
    }

    return this.http.get<User[]>(`${this.apiUrl}/users/`)
      .pipe(
        catchError((error) => {
          return of(mockData.users as User[]);
        })
      );
  }

  getUser(id: number): Observable<User> {
    if (this.useMockData) {
      const user = mockData.users.find(u => u.id === id);
      if (user) {
        return of(user as User);
      }
      return throwError(() => new Error('Bruger ikke fundet'));
    }

    return this.http.get<User>(`${this.apiUrl}/users/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createUser(user: Omit<User, 'id' | 'created_at' | 'is_active' | 'last_login'>): Observable<User> {
    if (this.useMockData) {
      // Simulate user creation with mock data
      const newUser: User = {
        ...user,
        id: Math.max(...mockData.users.map(u => u.id)) + 1,
        is_active: true,
        created_at: new Date().toISOString(),
        last_login: undefined
      };
      return of(newUser);
    }

    return this.http.post<User>(`${this.apiUrl}/users/`, user)
      .pipe(
        catchError(this.handleError)
      );
  }

  createTestUsers(): Observable<any> {
    if (this.useMockData) {
      // Return existing test users from mock data
      return of({ message: 'Test brugere allerede oprettet i mock data' });
    }

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

    return this.createUser(testUsers[0]);
  }

  // Approval Request endpoints
  getApprovalRequests(filters?: ApprovalFilters): Observable<ApprovalRequestList> {
    if (this.useMockData) {
      let filteredRequests = [...mockData.approvalRequests];
      
      // Apply filters
      if (filters?.status) {
        filteredRequests = filteredRequests.filter(r => r.status === filters.status);
      }
      if (filters?.priority) {
        filteredRequests = filteredRequests.filter(r => r.priority === filters.priority);
      }
      if (filters?.category) {
        filteredRequests = filteredRequests.filter(r => r.category === filters.category);
      }
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredRequests = filteredRequests.filter(r => 
          r.title.toLowerCase().includes(searchLower) ||
          r.description.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply pagination
      const skip = filters?.skip || 0;
      const limit = filters?.limit || 12;
      const paginatedRequests = filteredRequests.slice(skip, skip + limit);
      
      return of({
        requests: paginatedRequests as ApprovalRequest[],
        total: filteredRequests.length,
        page: Math.floor(skip / limit) + 1,
        per_page: limit
      });
    }

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
        catchError((error) => {
          // Fallback to mock data
          return this.getApprovalRequests(filters);
        })
      );
  }

  getApprovalRequest(id: number): Observable<ApprovalRequest> {
    if (this.useMockData) {
      const request = mockData.approvalRequests.find(r => r.id === id);
      if (request) {
        return of(request as ApprovalRequest);
      }
      return throwError(() => new Error('Anmodning ikke fundet'));
    }

    return this.http.get<ApprovalRequest>(`${this.apiUrl}/approval-requests/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  createApprovalRequest(request: CreateApprovalRequest, requesterId: number): Observable<ApprovalRequest> {
    if (this.useMockData) {
      // Simulate request creation with mock data
      const newRequest: any = {
        ...request,
        id: Math.max(...mockData.approvalRequests.map(r => r.id)) + 1,
        status: 'pending',
        requester_id: requesterId,
        created_at: new Date().toISOString(),
        reference_number: `REQ-${new Date().getFullYear()}-${String(mockData.approvalRequests.length + 1).padStart(3, '0')}`,
        requester: mockData.users.find(u => u.id === requesterId),
        approver: mockData.users.find(u => u.id === request.approver_id),
        comments: []
      };
      
      // Add to mock data (in memory only)
      mockData.approvalRequests.push(newRequest);
      
      return of(newRequest as ApprovalRequest);
    }

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
    if (this.useMockData) {
      const requestIndex = mockData.approvalRequests.findIndex(r => r.id === id);
      if (requestIndex >= 0) {
        // Update the request in mock data
        mockData.approvalRequests[requestIndex].status = update.status;
        if (update.status === 'approved' || update.status === 'rejected') {
          mockData.approvalRequests[requestIndex].approved_at = new Date().toISOString();
        }
        
        // Add comment if provided
        if (update.comment) {
          const newComment: any = {
            id: Math.max(...mockData.approvalRequests[requestIndex].comments.map(c => c.id || 0), 0) + 1,
            content: update.comment,
            is_internal: false,
            user_id: userId,
            created_at: new Date().toISOString(),
            user: mockData.users.find(u => u.id === userId)
          };
          (mockData.approvalRequests[requestIndex].comments as any[]).push(newComment);
        }
        
        return of(mockData.approvalRequests[requestIndex] as ApprovalRequest);
      }
      return throwError(() => new Error('Anmodning ikke fundet'));
    }

    const params = new HttpParams().set('user_id', userId.toString());
    return this.http.put<ApprovalRequest>(`${this.apiUrl}/approval-requests/${id}`, update, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Comment endpoints
  addComment(requestId: number, content: string, userId: number, isInternal: boolean = false): Observable<any> {
    if (this.useMockData) {
      const requestIndex = mockData.approvalRequests.findIndex(r => r.id === requestId);
      if (requestIndex >= 0) {
        const newComment: any = {
          id: Math.max(...mockData.approvalRequests[requestIndex].comments.map(c => c.id || 0), 0) + 1,
          content,
          is_internal: isInternal,
          user_id: userId,
          created_at: new Date().toISOString(),
          user: mockData.users.find(u => u.id === userId)
        };
        (mockData.approvalRequests[requestIndex].comments as any[]).push(newComment);
        return of(newComment);
      }
      return throwError(() => new Error('Anmodning ikke fundet'));
    }

    const params = new HttpParams()
      .set('content', content)
      .set('user_id', userId.toString())
      .set('is_internal', isInternal.toString());
    
    return this.http.post(`${this.apiUrl}/approval-requests/${requestId}/comments`, null, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  // Utility methods (unchanged)
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
      'Uddannelse': 'Uddannelse & Kurser',
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