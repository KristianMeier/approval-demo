// src/app/components/create-request/create-request.ts
import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApprovalService } from '../../services/approval';
import { User, CreateApprovalRequest, ApprovalRequest } from '../../models/approval.model';

@Component({
  selector: 'app-create-request',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './create-request.html',
  styleUrls: ['./create-request.css']
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