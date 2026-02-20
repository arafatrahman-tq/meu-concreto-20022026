## 🧠 Brainstorm: Global WhatsApp Instance Integration

### Context
Currently, the system requires each company to configure its own WhatsApp instance (API URL, API Key, Phone Number). This makes onboarding new companies tedious if they are all managed by the same entity. We need a way to flag one instance as "Global" so other companies can use it as a fallback, while still allowing them to customize *who* receives notifications.

---

### Option A: Hierarchical Fallback (Connection Inheritance)
Add an `isGlobal` boolean flag to the `whatsapp_settings` table. The system resolves the connection by looking for a company-specific record first. If it doesn't exist or is marked as "Empty", it falls back to the record marked `isGlobal`.

✅ **Pros:**
- Minimal schema changes (one column).
- Seamless transition: companies without settings can automatically "inherit" the global connection.
- Allows "hybrid" setups where a company uses the global connection but keeps its own notification toggles/recipients.

❌ **Cons:**
- Logic for "incomplete" settings (e.g., API URL present but Key missing) can be ambiguous.
- Potential performance hit if we don't cache the Global ID.
- Harder to "opt-out" of the global instance if you want *no* WhatsApp at all.

---

### Option B: The "Master Switch" (Explicit Global Toggle)
Add a `useGlobalWhatsapp` boolean to the `whatsapp_settings` table. When enabled for a specific company, the system ignores that company's individual API details and strictly uses the designated Global instance.

✅ **Pros:**
- Highly explicit and predictable behavior.
- Easy to audit which companies are using the shared instance via the UI.
- Decouples "Notification Recipients" (stays in the company row) from "Connection Provider" (stays in the global row).

❌ **Cons:**
- Requires the user to explicitly "opt-in" to the global instance instead of it being a passive fallback.
- Admin needs to ensure one (and only one) instance is marked as global to avoid conflicts.

---

### Option C: Centralized Connection Registry
Move `apiUrl`, `apiKey`, and `phoneNumber` into a new `whatsapp_instances` table. The `whatsapp_settings` table then becomes a join table/configuration table that links a `companyId` to an `instanceId`. One instance can be marked as `default`.

✅ **Pros:**
- Cleanest data model (Normalized).
- One instance can be shared by 5 companies, while another is exclusive to 1.
- Perfect for multi-instance providers (e.g., multiple phones for different regions).

❌ **Cons:**
- Most intrusive change; requires migrating existing data.
- More complex UI (managing instances vs. managing company settings).

---

### Comparison & Recommendation

| Feature | Option A (Fallback) | Option B (Toggle) | Option C (Registry) |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low | Medium | High |
| **Flexibility** | High | Medium | Very High |
| **Schema Impact**| Minimal | Minimal | Significant |

**Recommendation:**
I recommend **Option B (Explicit Global Toggle)**.
By adding `isGlobal` to the table (system-wide) and `useGlobal` (per company), we get the best of both worlds:
1. An admin marks Instance X as "Global".
2. Company B can check a box "Use System WhatsApp".
3. The code then fetches `apiUrl/apiKey` from Instance X, but keeps `alertRecipients` and `toggles` from Company B's own row.
4. This avoids the "magic inheritance" bugs of Option A while being much simpler to implement than Option C.
