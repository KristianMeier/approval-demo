// src/app/app.ts
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ApprovalService } from './services/approval';
import { ApprovalListComponent } from './components/approval-list/approval-list';
import { CreateRequestComponent } from './components/create-request/create-request';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule, ApprovalListComponent, CreateRequestComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit, OnDestroy {
  @ViewChild('approvalList') approvalList!: ApprovalListComponent;
  
  title = 'frontend';
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
    // Delay WebSocket connection to avoid immediate failures
    setTimeout(() => {
      this.setupWebSocket();
      this.loadSystemInfo();
      this.startPeriodicUpdates();
    }, 500);
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
    console.log('Dst Approval Flows starter op...');
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
        alert(`❌ Fejl ved oprettelse: ${error.message}`);
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