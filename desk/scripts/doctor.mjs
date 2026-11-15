import {doctorChecks,doctorText,doctorExitCode} from '../doctor-checks.mjs';

/* As checagens moram em `doctor-checks.mjs` (#62): o "Relatar um problema"
   reaproveita a mesma fonte. Aqui só se imprime e se sai com 1 quando algo
   falha; pendente da primeira abertura não é falha (#89). */
const {rows}=doctorChecks();
console.log(doctorText(rows));
if(doctorExitCode(rows))process.exitCode=1;
