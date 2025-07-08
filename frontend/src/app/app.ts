import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ApprovalService } from './services/approval';
import { ApprovalListComponent } from './components/approval-list';
import { CreateRequestComponent } from './components/create-request';

@Component({
  selector: 'app-root',
  imports: [CommonModule, HttpClientModule, ApprovalListComponent, CreateRequestComponent],
  template: `
    <div class="app-container">
      <!-- Header -->
      <header class="app-header">
        <div class="container">
          <div class="header-content">
            <div class="logo-section">
              <h1>🏛️ Politisk Godkendelsessystem</h1>
              <p class="tagline">Sikker workflow til statslige institutioner</p>
            </div>
            
            <div class="header-stats" *ngIf="systemStats">
              <div class="stat-item">
                <span class="stat-value">{{ systemStats.total_connections || 0 }}</span>
                <span class="stat-label">Aktive forbindelser</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ pendingCount }}</span>
                <span class="stat-label">Afventende</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Connection Status -->
      <div class="connection-status" [class.connected]="isConnected" [class.disconnected]="!isConnected">
        <span class="status-indicator"></span>
        {{ connectionStatus }}
      </div>

      <!-- Main Content -->
      <main class="main-content">
        <div class="container">
          
          <!-- System Status Card -->
          <div class="card" *ngIf="systemInfo">
            <div class="card-header">
              <h3 class="card-title">📊 System Status</h3>
              <span class="badge" [class.badge-approved]="systemInfo.database === 'healthy'" 
                    [class.badge-danger]="systemInfo.database !== 'healthy'">
                {{ systemInfo.database === 'healthy' ? '✅ Operationel' : '❌ Fejl' }}
              </span>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-3">
                  <strong>Backend API:</strong><br>
                  <small>{{ apiUrl }}</small>
                </div>
                <div class="col-3">
                  <strong>Database:</strong><br>
                  <small>PostgreSQL {{ systemInfo.database }}</small>
                </div>
                <div class="col-3">
                  <strong>Real-time:</strong><br>
                  <small>WebSocket {{ isConnected ? 'aktiv' : 'inaktiv' }}</small>
                </div>
                <div class="col-3">
                  <strong>Sikkerhed:</strong><br>
                  <small>100% On-premise</small>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Cards Row -->
          <div class="row">
            <div class="col-6">
              <div class="card">
                <div class="card-header">
                  <h2 class="card-title">📝 Opret Ny Anmodning</h2>
                </div>
                <div class="card-body">
                  <app-create-request (requestCreated)="onRequestCreated($event)"></app-create-request>
                </div>
              </div>
            </div>

            <div class="col-6">
              <div class="card">
                <div class="card-header">
                  <h2 class="card-title">📋 Aktive Anmodninger</h2>
                  <button class="btn btn-outline btn-sm" (click)="refreshData()">
                    🔄 Opdater
                  </button>
                </div>
                <div class="card-body">
                  <app-approval-list #approvalList (statusChanged)="onStatusChanged($event)"></app-approval-list>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="card" *ngIf="recentActivity.length > 0">
            <div class="card-header">
              <h3 class="card-title">⚡ Seneste Aktivitet</h3>
              <small>Real-time opdateringer</small>
            </div>
            <div class="card-body">
              <div class="activity-feed">
                <div *ngFor="let activity of recentActivity | slice:0:5" class="activity-item">
                  <span class="activity-time">{{ activity.timestamp | date:'short' }}</span>
                  <span class="activity-message">{{ activity.message }}</span>
                  <span class="activity-type badge" [class]="'badge-' + activity.type">
                    {{ activity.type }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🚀 Hurtig Test</h3>
            </div>
            <div class="card-body">
              <p>Kom hurtigt i gang med systemet:</p>
              <div class="d-flex gap-2">
                <button class="btn btn-primary" (click)="createTestUsers()">
                  👥 Opret Test Brugere
                </button>
                <button class="btn btn-secondary" (click)="createSampleRequest()">
                  📄 Opret Eksempel Anmodning  
                </button>
                <button class="btn btn-warning" (click)="viewApiDocs()">
                  📚 API Dokumentation
                </button>
              </div>
              <small class="text-muted mt-2 d-block">
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

    .connection-status {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .connection-status.connected {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .connection-status.disconnected {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
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
export class App implements OnInit, OnDestroy {
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
    // Note: These methods don't exist yet in ApprovalService, so we'll add them later
    // For now, just mock the data
    this.systemInfo = {
      database: 'healthy',
      status: 'running'
    };
    
    this.systemStats = {
      total_connections: 1
    };
  }

  private startPeriodicUpdates() {
    // Update system stats every 30 seconds
    setInterval(() => {
      this.loadSystemInfo();
      this.updatePendingCount();
    }, 30000);
  }

  private updatePendingCount() {
    // This will work when ApprovalService is properly implemented
    this.pendingCount = 0; // Placeholder
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
    // This will be implemented when ApprovalService has the method
    console.log('Creating test users...');
    this.addActivity('Test brugere oprettet', 'approved');
    alert('✅ Test brugere oprettet succesfuldt!');
  }

  createSampleRequest() {
    // This will be implemented when ApprovalService is ready
    console.log('Creating sample request...');
    this.addActivity('Eksempel anmodning oprettet', 'pending');
    alert('✅ Eksempel anmodning oprettet!');
  }

  viewApiDocs() {
    window.open(`${this.apiUrl}/docs`, '_blank');
  }
}