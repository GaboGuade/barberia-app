# Barbería — Sistema de agendamiento

Aplicación web (Next.js 14 + Tailwind + Supabase) para que los clientes reserven citas de barbería en intervalos de **1 hora**, con panel de empleados y registro administrativo protegidos por login.

- 💈 Servicios: **Corte $10**, **Corte + Barba $15**
- � Cliente elige **barbero** (Jose, Gabriel, Alejandro) y extras de cortesía (mascarilla, masaje, bebida)
- �💵 Pago en efectivo: **USD** o **Bolívares** (se cobra en sitio)
- 🕘 Horario: **Lunes a Sábado, 9:00 – 19:00** (domingo cerrado)
- � Login para **empleados** y **administrador** (Supabase Auth)
- 🧔 `/panel`: cada barbero ve y gestiona SUS citas (completada / no asistió / cancelada)
- 📒 `/citas`: registro administrativo (solo admin) con filtros, ingresos por barbero y totales

---

## 1. Configurar Supabase (paso a paso)

1. Crea una cuenta gratis en https://supabase.com y haz click en **New project**.
2. Elige una organización, dale un nombre (ej. `barberia`), establece una contraseña de DB y la región más cercana.
3. Espera ~2 min a que se aprovisione el proyecto.
4. En el panel del proyecto, ve a **Project Settings → API**. Copia:
   - **Project URL** → será tu `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → será tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Ve a **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](./supabase/schema.sql) y dale **Run**.
   - Esto crea las tablas `appointments` y `staff`, las restricciones, el trigger anti doble-cita por barbero, la función pública `get_booked_slots` y las políticas RLS.

### 1.1 Crear las cuentas de empleados y admin

1. En Supabase: **Authentication → Users → Add user** (marca **Auto Confirm**). Crea por ejemplo:
   - `dueno@barberia.com` (tú, administrador)
   - `jose@barberia.com`, `gabriel@barberia.com`, `alejandro@barberia.com`
2. Copia el **UUID** de cada usuario y ejecuta en SQL Editor:

```sql
insert into public.staff (id, display_name, role, barber_key) values
  ('UUID-DEL-DUENO',    'Dueño',     'admin',   null),
  ('UUID-DE-JOSE',      'Jose',      'barbero', 'jose'),
  ('UUID-DE-GABRIEL',   'Gabriel',   'barbero', 'gabriel'),
  ('UUID-DE-ALEJANDRO', 'Alejandro', 'barbero', 'alejandro')
on conflict (id) do update
  set display_name = excluded.display_name,
      role = excluded.role,
      barber_key = excluded.barber_key;
```

3. Listo: entra en `/login` con esas credenciales.
   - Rol `admin` → va a `/citas` (registro completo, ingresos, acciones).
   - Rol `barbero` → va a `/panel` (solo sus citas).

## 2. Configurar variables de entorno

Copia `.env.local.example` a `.env.local` y rellena:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_BS_RATE=40   # opcional, para mostrar conversión a Bs.
```

> En PowerShell:
> ```powershell
> Copy-Item .env.local.example .env.local
> ```

## 3. Instalar y correr

```powershell
npm install
npm run dev
```

Abre http://localhost:3000

## 4. Estructura

```
barberia-app/
├─ app/
│  ├─ layout.tsx           # Layout raíz
│  ├─ globals.css          # Tailwind base
│  ├─ page.tsx             # Landing + formulario de reserva (público)
│  ├─ login/
│  │  └─ page.tsx          # Login de empleados/admin
│  ├─ panel/
│  │  └─ page.tsx          # Panel del barbero (sus citas)
│  └─ citas/
│     └─ page.tsx          # Registro administrativo (solo admin)
├─ components/
│  └─ BookingForm.tsx      # Formulario cliente con disponibilidad en vivo
├─ lib/
│  ├─ constants.ts         # Servicios, precios, barberos, horarios
│  ├─ auth.ts              # Hook useStaff (sesión + rol)
│  └─ supabase.ts          # Cliente Supabase + tipos
├─ supabase/
│  └─ schema.sql           # Esquema completo (tablas + RLS + triggers + RPC)
├─ tailwind.config.ts
├─ next.config.js
└─ package.json
```

## 5. Reglas de negocio garantizadas en la BD

| Regla | Cómo se aplica |
|---|---|
| Solo horas en punto (1h) | `CHECK (minute=0 AND second=0)` |
| Horario laboral 9–18 | `CHECK appointment_time BETWEEN 09:00 AND 18:00` |
| Cerrado los domingos | `CHECK extract(dow ...) <> 0` |
| Servicios válidos | `CHECK service IN ('corte','corte_barba')` |
| Pago válido | `CHECK payment_currency IN ('USD','VES')` |
| Estados válidos | `CHECK status IN ('agendada','completada','cancelada','no_asistio')` |
| 1 cita por barbero/horario | Trigger `enforce_appointment_capacity` |
| Barberos válidos | `CHECK barber IN ('jose','gabriel','alejandro')` |
| Bebidas válidas | `CHECK drink IN ('cerveza','malta','coca_cola')` |
| Reservar sin cuenta | RLS: `INSERT` para `anon` (solo status 'agendada') |
| Datos de clientes protegidos | RLS: `SELECT`/`UPDATE` solo para staff autenticado |
| Disponibilidad pública anónima | RPC `get_booked_slots(date)` (solo hora + barbero) |

## 6. Flujo de la aplicación

**Cliente (sin cuenta):**
1. Abre `/`, elige servicio, barbero, fecha y hora (los horarios ocupados del barbero aparecen tachados).
2. Personaliza su experiencia: mascarilla, masaje, bebida de cortesía.
3. Ingresa nombre y teléfono (validados), método de pago y confirma.
4. Si el barbero se ocupó justo antes, la BD lo rechaza y la UI avisa.

**Barbero:**
1. Entra en `/login` → es dirigido a `/panel`.
2. Ve sus próximas citas agrupadas por día, con servicio, extras y monto.
3. Marca cada cita: completada / no asistió / cancelada.

**Administrador (dueño):**
1. Entra en `/login` → es dirigido a `/citas`.
2. Filtra por barbero, estado y rango de fechas.
3. Ve ingresos totales y por barbero, con desglose de servicios.
4. También puede gestionar estados de cualquier cita.

## 7. Próximos pasos sugeridos (opcionales)

- % de comisión de la barbería por barbero (reparto de ingresos).
- Notificaciones por WhatsApp/Email al confirmar.
- Exportar a CSV el registro de citas.
- Historial de clientes frecuentes.
