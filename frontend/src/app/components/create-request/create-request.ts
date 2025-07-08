import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApprovalService } from '../services/approval';
import { User, CreateApprovalRequest, ApprovalRequest } from '../models/approval.model';

@Component({
  selector: 'app-create-request',
  template: `
    <div class="create-request">
      
      <!-- Success/Error Messages -->
      <div *ngIf="successMessage" class="alert alert-success">
        ✅ {{ successMessage }}
      </div>

      <div *ngIf="errorMessage" class="alert alert-danger">
        ❌ {{ errorMessage }}
      </div>

      <!-- Main Form -->
      <form [formGroup]="requestForm" (ngSubmit)="onSubmit()">
        
        <!-- Title -->
        <div class="form-group">
          <label for="title" class="form-label">Titel *</label>
          <input 
            type="text" 
            id="title"
            class="form-control" 
            formControlName="title"
            placeholder="F.eks. Nyt kontorudstyr, IT-udstyr, rejsegodkendelse..."
            [class.is-invalid]="requestForm.get('title')?.invalid && requestForm.get('title')?.touched">
          <div *ngIf="requestForm.get('title')?.invalid && requestForm.get('title')?.touched" class="invalid-feedback">
            Titel er påkrævet
          </div>
        </div>

        <!-- Description -->
        <div class="form-group">
          <label for="description" class="form-label">Beskrivelse *</label>
          <textarea 
            id="description"
            class="form-control" 
            formControlName="description"
            rows="4"
            placeholder="Detaljeret beskrivelse af anmodningen, begrundelse, specifikationer..."
            [class.is-invalid]="requestForm.get('description')?.invalid && requestForm.get('description')?.touched"></textarea>
          <div *ngIf="requestForm.get('description')?.invalid && requestForm.get('description')?.touched" class="invalid-feedback">
            Beskrivelse er påkrævet
          </div>
        </div>

        <!-- Category and Priority Row -->
        <div class="row">
          <div class="col-6">
            <div class="form-group">
              <label for="category" class="form-label">Kategori *</label>
              <select 
                id="category" 
                class="form-control" 
                formControlName="category"
                [class.is-invalid]="requestForm.get('category')?.invalid && requestForm.get('category')?.touched">
                <option value="">Vælg kategori</option>
                <option value="IT">🖥️ IT & Teknologi</option>
                <option value="Indkøb">🛒 Indkøb & Procurement</option>
                <option value="HR">👥 Personal & HR</option>
                <option value="Økonomi">💰 Økonomi & Budget</option>
                <option value="Drift">🔧 Drift & Vedligeholdelse</option>
                <option value="Rejse">✈️ Rejse & Transport</option>
                <option value="Uddannelse">📚 Uddannelse & Kurser</option>
                <option value="Andet">📋 Andet</option>
              </select>
              <div *ngIf="requestForm.get('category')?.invalid && requestForm.get('category')?.touched" class="invalid-feedback">
                Kategori er påkrævet
              </div>
            </div>
          </div>

          <div class="col-6">
            <div class="form-group">
              <label for="priority" class="form-label">Prioritet *</label>
              <select 
                id="priority" 
                class="form-control" 
                formControlName="priority">
                <option value="low">🟢 Lav - Ikke kritisk</option>
                <option value="medium">🟡 Mellem - Normal hastighed</option>
                <option value="high">🟠 Høj - Vigtigt</option>
                <option value="urgent">🔴 Akut - Kritisk</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Amount and Due Date Row -->
        <div class="row">
          <div class="col-6">
            <div class="form-group">
              <label for="amount" class="form-label">Beløb (DKK)</label>
              <input 
                type="number" 
                id="amount"
                class="form-control" 
                formControlName="amount"
                placeholder="0"
                min="0"
                step="1"
                [class.is-invalid]="requestForm.get('amount')?.invalid && requestForm.get('amount')?.touched">
              <small class="form-text">Lad stå tom hvis ikke relevant</small>
              <div *ngIf="requestForm.get('amount')?.invalid && requestForm.get('amount')?.touched" class="invalid-feedback">
                Beløb skal være positivt
              </div>
            </div>
          </div>

          <div class="col-6">
            <div class="form-group">
              <label for="due_date" class="form-label">Ønsket frist</label>
              <input 
                type="date" 
                id="due_date"
                class="form-control" 
                formControlName="due_date"
                [min]="minDate">
              <small class="form-text">Hvornår skal dette være færdigt?</small>
            </div>
          </div>
        </div>

        <!-- Approver Selection -->
        <div class="form-group">
          <label for="approver" class="form-label">Godkender *</label>
          <select 
            id="approver" 
            class="form-control" 
            formControlName="approver_id"
            [class.is-invalid]="requestForm.get('approver_id')?.invalid && requestForm.get('approver_id')?.touched">
            <option value="">Vælg godkender</option>
            <option *ngFor="let user of users" [value]="user.id">
              {{ user.name }} - {{ user.role }}
              <span *ngIf="user.department">({{ user.department }})</span>
            </option>
          </select>
          <div *ngIf="requestForm.get('approver_id')?.invalid && requestForm.get('approver_id')?.touched" class="invalid-feedback">
            Godkender er påkrævet
          </div>
          <small class="form-text">Vælg den person der skal godkende denne anmodning</small>
        </div>

        <!-- External Reference (Optional) -->
        <div class="form-group">
          <label for="external_reference" class="form-label">Ekstern reference</label>
          <input 
            type="text" 
            id="external_reference"
            class="form-control" 
            formControlName="external_reference"
            placeholder="F.eks. sagsnummer, fakturanummer, kontrakt ID...">
          <small class="form-text">Valgfrit - reference til eksisterende sager eller dokumenter</small>
        </div>

        <!-- Confidentiality Level -->
        <div class="form-group">
          <label for="confidentiality_level" class="form-label">Fortrolighedsniveau</label>
          <select 
            id="confidentiality_level" 
            class="form-control" 
            formControlName="confidentiality_level">
            <option value="normal">🔓 Normal - Standard adgang</option>
            <option value="confidential">🔒 Fortroligt - Begrænset adgang</option>
            <option value="secret">🔐 Hemmeligt - Højeste sikkerhed</option>
          </select>
          <small class="form-text">Vælg passende sikkerhedsniveau for denne anmodning</small>
        </div>

        <!-- Submit Button -->
        <div class="form-actions">
          <button 
            type="submit" 
            class="btn btn-primary btn-lg" 
            [disabled]="!requestForm.valid || submitting">
            <span *ngIf="submitting">⏳ Opretter...</span>
            <span *ngIf="!submitting">📤 Opret Godkendelsesanmodning</span>
          </button>
          
          <button 
            type="button" 
            class="btn btn-secondary btn-lg" 
            (click)="resetForm()"
            [disabled]="submitting">
            🔄 Nulstil
          </button>
        </div>

        <!-- Form Validation Summary -->
        <div *ngIf="!requestForm.valid && requestForm.touched" class="alert alert-warning mt-3">
          <strong>⚠️ Manglende oplysninger:</strong>
          <ul class="mb-0 mt-2">
            <li *ngIf="requestForm.get('title')?.invalid">Titel er påkrævet</li>
            <li *ngIf="requestForm.get('description')?.invalid">Beskrivelse er påkrævet</li>
            <li *ngIf="requestForm.get('category')?.invalid">Kategori skal vælges</li>
            <li *ngIf="requestForm.get('approver_id')?.invalid">Godkender skal vælges</li>
            <li *ngIf="requestForm.get('amount')?.invalid">Beløb skal være positivt (eller tomt)</li>
          </ul>
        </div>
      </form>

      <!-- Quick Actions Section -->
      <div class="quick-actions-section">
        <div class="card">
          <div class="card-header">
            <h4>🚀 Hurtig Start</h4>
          </div>
          <div class="card-body">
            <p>Mangler test data? Opret hurtig test setup:</p>
            <div class="d-flex gap-2">
              <button 
                (click)="createTestUsers()" 
                class="btn btn-outline btn-sm"
                [disabled]="creatingTestData">
                <span *ngIf="creatingTestData">⏳</span>
                <span *ngIf="!creatingTestData">👥</span>
                Opret Test Brugere
              </button>
              
              <button 
                (click)="fillSampleData()" 
                class="btn btn-outline btn-sm">
                📝 Udfyld Eksempel Data
              </button>
              
              <button 
                (click)="viewFormHelp()" 
                class="btn btn-outline btn-sm">
                ❓ Hjælp
              </button>
            </div>
            <small class="text-muted d-block mt-2">
              Test brugere: Manager Jensen (godkender) og Medarbejder Hansen (anmoder)
            </small>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .create-request {
      width: 100%;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }

    .invalid-feedback {
      color: #dc3545;
      font-size: 0.875rem;
      margin-top: 4px;
    }

    .is-invalid {
      border-color: #dc3545;
    }

    .form-text {
      color: #6c757d;
      font-size: 0.8rem;
      margin-top: 4px;
    }

    .quick-actions-section {
      margin-top: 30px;
    }

    .quick-actions-section .card {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border: 1px solid #dee2e6;
    }

    .quick-actions-section .card-header h4 {
      margin: 0;
      color: #495057;
    }

    @media (max-width: 768px) {
      .form-actions {
        flex-direction: column;
      }
      
      .btn-lg {
        width: 100%;
      }
    }
  `]
})
export class CreateRequestComponent implements OnInit {
  @Output() requestCreated = new EventEmitter<ApprovalRequest>();
  
  requestForm: FormGroup;
  users: User[] = [];
  submitting = false;
  creatingTestData = false;
  successMessage = '';
  errorMessage = '';
  minDate = new Date().toISOString().split('T')[0]; // Today's date

  constructor(
    private fb: FormBuilder,
    private approvalService: ApprovalService
  ) {
    this.requestForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      category: ['', Validators.required],
      priority: ['medium', Validators.required],
      amount: [null, [Validators.min(0)]],
      approver_id: ['', Validators.required],
      due_date: [''],
      external_reference: [''],
      confidentiality_level: ['normal']
    });
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.approvalService.getUsers().subscribe({
      next: (users) => {
        this.users = users.filter(user => user.is_active);
        
        // If no users found, suggest creating test users
        if (this.users.length === 0) {
          this.errorMessage = 'Ingen brugere fundet. Opret test brugere for at komme i gang.';
        }
      },
      error: (error) => {
        console.error('Fejl ved indlæsning af brugere:', error);
        this.errorMessage = `Fejl ved indlæsning af brugere: ${error.message}`;
      }
    });
  }

  onSubmit() {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      this.errorMessage = 'Udfyld venligst alle påkrævede felter korrekt.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formData = this.requestForm.value;
    
    // Clean up form data
    const requestData: CreateApprovalRequest = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      priority: formData.priority,
      amount: formData.amount || undefined,
      approver_id: parseInt(formData.approver_id),
      due_date: formData.due_date || undefined,
      external_reference: formData.external_reference?.trim() || undefined,
      confidentiality_level: formData.confidentiality_level || 'normal'
    };

    this.approvalService.createApprovalRequest(requestData, 2).subscribe({
      next: (response) => {
        this.successMessage = `Anmodning "${response.title}" er oprettet succesfuldt! Reference: ${response.reference_number}`;
        this.requestForm.reset();
        this.requestForm.patchValue({ 
          priority: 'medium',
          confidentiality_level: 'normal' 
        });
        this.submitting = false;
        this.requestCreated.emit(response);
        
        // Clear success message after 5 seconds
        setTimeout(() => this.successMessage = '', 5000);
      },
      error: (error) => {
        this.errorMessage = `Fejl ved oprettelse af anmodning: ${error.message}`;
        this.submitting = false;
        console.error('Fejl:', error);
      }
    });
  }

  resetForm() {
    this.requestForm.reset();
    this.requestForm.patchValue({ 
      priority: 'medium',
      confidentiality_level: 'normal' 
    });
    this.successMessage = '';
    this.errorMessage = '';
  }

  fillSampleData() {
    this.requestForm.patchValue({
      title: 'Nyt laptop til udvikling',
      description: 'Har brug for en ny laptop til softwareudvikling. Nuværende laptop er for langsom og har ikke tilstrækkelig RAM til de opgaver jeg arbejder med. Ønsker en laptop med mindst 16GB RAM og SSD disk.',
      category: 'IT',
      priority: 'medium',
      amount: 15000,
      external_reference: 'IT-2024-001',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days from now
    });

    // Select first available manager as approver
    const manager = this.users.find(u => u.role.toLowerCase().includes('manager'));
    if (manager) {
      this.requestForm.patchValue({ approver_id: manager.id });
    }
  }

  createTestUsers() {
    this.creatingTestData = true;
    
    this.approvalService.createTestUsers().subscribe({
      next: () => {
        this.successMessage = 'Test brugere oprettet succesfuldt!';
        this.loadUsers(); // Reload users
        this.creatingTestData = false;
        
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (error) => {
        // Users might already exist
        if (error.message.includes('allerede registreret')) {
          this.successMessage = 'Test brugere er allerede oprettet.';
          this.loadUsers();
        } else {
          this.errorMessage = `Fejl ved oprettelse af test brugere: ${error.message}`;
        }
        this.creatingTestData = false;
      }
    });
  }

  viewFormHelp() {
    const helpText = `
🔤 TITEL: Kort, beskrivende navn for anmodningen

📝 BESKRIVELSE: Detaljeret forklaring af hvad du har brug for og hvorfor

📁 KATEGORI: Vælg den kategori der bedst beskriver din anmodning

⚡ PRIORITET:
• Lav: Ikke kritisk, kan vente
• Mellem: Normal hastighed
• Høj: Vigtigt, skal behandles snart  
• Akut: Kritisk, skal behandles med det samme

💰 BELØB: Hvis anmodningen involverer et køb eller udgift

📅 FRIST: Hvornår skal dette være færdigt?

👤 GODKENDER: Vælg den person der skal godkende din anmodning

🔗 EKSTERN REFERENCE: Hvis dette relaterer til en eksisterende sag

🔒 FORTROLIGHEDSNIVEAU: Hvor følsom er denne information?
    `;

    alert(helpText);
  }
}

# Done! All 4 artifacts are now complete with:
# 1. Setup instructions and folder structure
# 2. Docker and config files  
# 3. Complete backend with FastAPI, PostgreSQL, WebSockets
# 4. Complete frontend with Angular, real-time UI, forms

# The system includes:
# ✅ Real-time WebSocket notifications
# ✅ Complete CRUD operations  
# ✅ Advanced filtering and search
# ✅ Comment system
# ✅ Priority and status management
# ✅ Danish political interface
# ✅ On-premise security
# ✅ Audit logging
# ✅ Test data creation
# ✅ Responsive design
# ✅ Error handling
# ✅ Form validationtext-muted mt-2 d-block">
                Disse funktioner hjælper dig med at teste systemet hurtigt
              </small>
            </div>
          </div>

        </div>
      </main>

      <!-- Footer -->
      <footer class="app-footer">
        <div class="container">
          <div class="footer-content">
            <div class="footer-section">
              <strong>Politisk Godkendelsessystem v1.0</strong>
              <small>Bygget til dansk politik - Sikkerhed først 🇩🇰</small>
            </div>
            <div class="footer-section">
              <small>
                <strong>Support:</strong> systemadministrator@institution.dk<br>
                <strong>Status:</strong> {{ isConnected ? '🟢 Online' : '🔴 Offline' }}
              </small>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .app-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 0;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-section h1 {
      color: white;
      margin: 0;
      font-size: 2rem;
    }

    .tagline {
      margin: 0;
      opacity: 0.9;
      font-size: 1rem;
    }

    .header-stats {
      display: flex;
      gap: 20px;
    }

    .stat-item {
      text-align: center;
    }

    .stat-value {
      display: block;
      font-size: 1.5rem;
      font-weight: bold;
    }

    .stat-label {
      font-size: 0.8rem;
      opacity: 0.8;
    }

    .main-content {
      flex: 1;
      padding: 30px 0;
    }

    .activity-feed {
      max-height: 200px;
      overflow-y: auto;
    }

    .activity-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }

    .activity-time {
      font-size: 0.8rem;
      color: #666;
      min-width: 120px;
    }

    .activity-message {
      flex: 1;
      margin: 0 12px;
    }

    .app-footer {
      background: #2c3e50;
      color: white;
      padding: 20px 0;
      margin-top: auto;
    }

    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .footer-section small {
      display: block;
      opacity: 0.8;
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        gap: 16px;
        text-align: center;
      }

      .footer-content {
        flex-direction: column;
        gap: 12px;
        text-align: center;
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('approvalList') approvalList!: ApprovalListComponent;
  
  connectionStatus = 'Opretter forbindelse...';
  isConnected = false;
  apiUrl = 'http://localhost:8000';
  systemInfo: any = null;
  systemStats: any = null;
  recentActivity: any[] = [];
  pendingCount = 0;
  
  private websocket: WebSocket | null = null;
  private reconnectInterval: any = null;

  constructor(private approvalService: ApprovalService) {}

  ngOnInit() {
    this.initializeApp();
    this.setupWebSocket();
    this.loadSystemInfo();
    this.startPeriodicUpdates();
  }

  ngOnDestroy() {
    if (this.websocket) {
      this.websocket.close();
    }
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
  }

  private initializeApp() {
    console.log('🏛️ Politisk Godkendelsessystem starter op...');
    this.addActivity('System startet', 'info');
  }

  private setupWebSocket() {
    const wsUrl = 'ws://localhost:8000/ws/1?role=admin';
    
    try {
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        this.connectionStatus = 'Real-time forbindelse etableret';
        this.isConnected = true;
        this.addActivity('WebSocket forbindelse etableret', 'approved');
        console.log('✅ WebSocket forbundet');
      };
      
      this.websocket.onclose = () => {
        this.connectionStatus = 'Real-time forbindelse afbrudt';
        this.isConnected = false;
        this.addActivity('WebSocket forbindelse afbrudt', 'rejected');
        console.log('❌ WebSocket afbrudt');
        
        // Auto-reconnect after 5 seconds
        setTimeout(() => this.setupWebSocket(), 5000);
      };
      
      this.websocket.onerror = () => {
        this.connectionStatus = 'Fejl i real-time forbindelse';
        this.isConnected = false;
        this.addActivity('WebSocket fejl', 'rejected');
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (e) {
          console.error('Fejl ved parsing af WebSocket besked:', e);
        }
      };
      
    } catch (error) {
      console.error('Fejl ved oprettelse af WebSocket:', error);
      this.connectionStatus = 'Kan ikke oprette forbindelse';
      this.isConnected = false;
    }
  }

  private handleWebSocketMessage(data: any) {
    console.log('📨 WebSocket besked:', data);
    
    switch (data.type) {
      case 'new_request':
        this.addActivity(`Ny anmodning: ${data.title}`, 'pending');
        this.refreshData();
        break;
        
      case 'status_update':
        this.addActivity(`Status opdateret: ${data.message}`, data.status);
        this.refreshData();
        break;
        
      case 'approval_decision':
        this.addActivity(`Beslutning: ${data.message}`, data.status);
        this.refreshData();
        break;
        
      case 'ping':
        // Respond to ping with pong
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send('pong');
        }
        break;
        
      default:
        console.log('Ukendt besked type:', data.type);
    }
  }

  private loadSystemInfo() {
    this.approvalService.getSystemHealth().subscribe({
      next: (info) => {
        this.systemInfo = info;
        this.addActivity('System sundhedstjek gennemført', 'approved');
      },
      error: (error) => {
        console.error('Fejl ved indlæsning af system info:', error);
        this.addActivity('System sundhedstjek fejlede', 'rejected');
      }
    });

    this.approvalService.getWebSocketStats().subscribe({
      next: (stats) => {
        this.systemStats = stats;
      },
      error: (error) => {
        console.error('Fejl ved indlæsning af WebSocket stats:', error);
      }
    });
  }

  private startPeriodicUpdates() {
    // Update system stats every 30 seconds
    setInterval(() => {
      this.loadSystemInfo();
      this.updatePendingCount();
    }, 30000);
  }

  private updatePendingCount() {
    this.approvalService.getApprovalRequests({ status: 'pending', limit: 1 }).subscribe({
      next: (response) => {
        this.pendingCount = response.total;
      },
      error: (error) => {
        console.error('Fejl ved opdatering af pending count:', error);
      }
    });
  }

  private addActivity(message: string, type: string) {
    this.recentActivity.unshift({
      message,
      type,
      timestamp: new Date()
    });
    
    // Keep only last 20 activities
    if (this.recentActivity.length > 20) {
      this.recentActivity = this.recentActivity.slice(0, 20);
    }
  }

  onRequestCreated(request: any) {
    this.addActivity(`Anmodning oprettet: ${request.title}`, 'pending');
    this.refreshData();
  }

  onStatusChanged(event: any) {
    this.addActivity(`Status ændret til: ${event.status}`, event.status);
    this.refreshData();
  }

  refreshData() {
    if (this.approvalList) {
      this.approvalList.loadRequests();
    }
    this.updatePendingCount();
  }

  createTestUsers() {
    this.approvalService.createTestUsers().subscribe({
      next: () => {
        this.addActivity('Test brugere oprettet', 'approved');
        alert('✅ Test brugere oprettet succesfuldt!');
      },
      error: (error) => {
        console.error('Fejl ved oprettelse af test brugere:', error);
        this.addActivity('Fejl ved oprettelse af test brugere', 'rejected');
      }
    });
  }

  createSampleRequest() {
    const sampleRequest = {
      title: 'Test Anmodning - Kontorudstyr',
      description: 'Dette er en test anmodning til demonstration af systemet',
      category: 'IT',
      priority: 'medium' as any,
      amount: 5000,
      approver_id: 1
    };

    this.approvalService.createApprovalRequest(sampleRequest, 2).subscribe({
      next: (request) => {
        this.addActivity(`Eksempel anmodning oprettet: ${request.title}`, 'pending');
        this.refreshData();
        alert('✅ Eksempel anmodning oprettet!');
      },
      error: (error) => {
        console.error('Fejl ved oprettelse af eksempel anmodning:', error);
        alert('❌ Fejl ved oprettelse. Opret først test brugere.');
      }
    });
  }

  viewApiDocs() {
    window.open(`${this.apiUrl}/docs`, '_blank');
  }
}
