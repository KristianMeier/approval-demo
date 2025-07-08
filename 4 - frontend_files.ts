
# frontend/src/app/components/approval-list.component.ts
import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { ApprovalService } from '../services/approval.service';
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
              <small class="