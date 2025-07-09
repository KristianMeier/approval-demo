# Adgangsproces til Mappe A – Overblik i 5 trin

---

### 🟨 Trin 1 – Ansøgning
**Kristian** ansøger:  
> "Jeg vil gerne have adgang til mappe A."  
Sagen får **Sagsnr.**: `e746e7`.

---

### 🟨 Trin 2 – Godkendelse
**Bo** modtager en mail fra `workflowbot@dst.dk`:
> "Hej Bo, Godkender du (svar Ja eller Nej) sagsnr e746e7.  
> Kristian søger adgang til mappe A."

---

### 🟨 Trin 3 – Tilføjelse til venteliste
Hvis **Bo’s svarmail til `workflowbot@dst.dk`** indeholder **"Ja"**,  
tilføjes sagen med **Sagsnr. `e746e7`** til listen:  
🗂️ *Godkendte-og-Ubehandlede*

---

### 🟨 Trin 4 – Automatisk API-kald
Et **PowerShell-script** med navnet `AdgangTilMappe.ps1`  
kører hvert andet minut og kalder følgende API: dst.local/Godkendte-og-Ubehandlede

### 🟨 Trin 5 – Eksekvering
PowerShell-scriptet udfører **tre handlinger**:
1. Giver adgang til Mappe A.  
2. Sender en bekræftelsesmail til Kristian.  
3. Fjerner sagen fra *Godkendte-og-Ubehandlede*-listen.