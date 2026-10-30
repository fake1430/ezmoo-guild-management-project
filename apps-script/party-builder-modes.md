# Party Builder — เพิ่มโหมดและตั้งค่า Google Sheets

## สิ่งที่ตรวจพบจาก implementation เดิม

- `src/App.tsx` เก็บ PartyMode และ state ปาร์ตี้ชุดเดียว แล้วคัดลอกผลจาก `useParties` มาทับทุกครั้งที่โหลด สลับโหมดจึงทำ draft ที่ยังไม่บันทึกหายได้
- มี Guild League, Overrun และ Auction Party อยู่แล้ว ใช้ PartyBoard และ MemberPanel เดียวกัน
- ทุกปาร์ตี้มี 5 ช่อง สูงสุด 16 ปาร์ตี้ แบ่ง Raid A/B ฝั่งละ 8 (40 คน) ไม่มี state ของ Phase แยกต่างหาก ผู้ใช้ยืนยันให้โหมดใหม่ใช้โครงสร้างนี้ และคง Auction Party ไว้
- ลากสมาชิกด้วย IGN; Member ID เดิมใช้เป็น key ของรายการสมาชิก ไม่ได้ใช้แทนชื่อในข้อมูล save การแก้ครั้งนี้คงรูปแบบเดิมเพื่ออ่าน save เก่าได้
- ลากสมาชิกระหว่างช่องเพื่อ swap; ลากเลขปาร์ตี้เพื่อ swap ทั้งทีม; ปุ่มนำสมาชิกออก/ลากกลับ MemberPanel เพื่อ remove; คลิกขวาเลขปาร์ตี้เพื่อล้างทีม; ลากทีมลงถังขยะเพื่อลบทีม
- เดิมไม่มี Undo/Redo และ Screenshot ใช้ html-to-image คัดลอก clipboard เท่านั้น พื้นที่ภาพไม่รวมหัวข้อโหมด
- `googleApi.ts` ส่ง GET `action=party&sheet=...` และ POST `action=saveParty` พร้อม `sheet` และ `parties`; cache แยกตามชื่อชีตทั้ง frontend และ Apps Script
- `getMembers` อ่าน `Member.getDataRange().getDisplayValues()` จับคู่หัวคอลัมน์ที่ trim/lowercase/ยุบช่องว่าง ไม่ผูกกับตำแหน่งคอลัมน์
- Apps Script ตรวจ whitelist ชีต ก่อนบันทึกจะล็อก script และเขียนข้อมูลใหม่เฉพาะชีตที่เลือกตามระบบเดิม ไม่แตะชีตโหมดอื่น

## พฤติกรรมหลังแก้

ใช้ PartyBoard เดิมร่วมกันครบ 6 โหมด เพิ่ม draft และ Undo/Redo แยกตามโหมดใน `usePartyBuilder` และป้องกันผล request เก่าเขียนทับ request ใหม่
สลับโหมดหรือออกไปหน้าอื่นแล้วกลับมาจะรักษา draft ใน session ปัจจุบันไว้; การรีเฟรช/ปิดเว็บยังต้อง Save ก่อนตามระบบเดิม ไม่มีการบันทึก Google Sheets อัตโนมัติ
ปุ่มโหลดข้อมูลใหม่โหลดเฉพาะโหมดที่เลือกและโหลดสมาชิกใหม่ด้วย การโหลดทับ draft สามารถ Undo ได้
เพิ่มการเรียงสมาชิกตามชื่อ/อาชีพ ดาวน์โหลด PNG พร้อมชื่อโหมด และหัวข้อโหมดในภาพ

## ตั้งค่า Google Sheets ด้วยตนเอง

ยังไม่ได้ตรวจหัวคอลัมน์ของ spreadsheet จริงผ่านบัญชี Google และไม่ได้แก้ข้อมูลจริง
สำรอง spreadsheet ก่อนทำขั้นตอนด้วยตนเอง อย่าลบ เปลี่ยนชื่อ หรือ reset ชีตเดิม

1. เปิดชีต `Member` คง Member ID, IGN, Guild League และ Overrun เดิมทั้งหมด
2. ถ้ายังไม่มี ให้เพิ่มหัวคอลัมน์ต่อท้ายแถวหัวตาราง:

   | หัวคอลัมน์ | โหมด |
   | --- | --- |
   | `stellarClashClass` | Stellar Clash |
   | `valeOfClashClass` | Vale of Clash |
   | `vigridAvengeClass` | Vigrid Avenge |

   Script รองรับชื่อแบบ `Stellar Clash Class`, `Vale of Clash Class`, `Vigrid Avenge Class` และชื่อโหมดที่ไม่มีคำว่า Class ด้วย ไม่ต้องเพิ่มคอลัมน์ซ้ำถ้ามีชื่อที่รองรับอยู่แล้ว
3. กรอกเฉพาะอาชีพจริงของสมาชิกแต่ละโหมดในแถวเดิม ใช้ Member ID/IGN เดิม เว้นว่างได้ ห้ามคัดลอกอาชีพโหมดเก่าแทนโดยสมมุติ
4. เพิ่มชีตใหม่เฉพาะชื่อที่ยังไม่มี โดยใช้ชื่อให้ตรงทุกตัว:

   | โหมด | ชื่อชีตบันทึก | ฟิลด์อาชีพ |
   | --- | --- | --- |
   | Guild League | `GuildLeague` | `guildLeagueClass` |
   | Overrun | `Overrun` | `overrunClass` |
   | Stellar Clash | `StellarClash` | `stellarClashClass` |
   | Vale of Clash | `ValeOfClash` | `valeOfClashClass` |
   | Vigrid Avenge | `VigridAvenge` | `vigridAvengeClass` |
   | Auction Party | `AuctionParty` | ไม่ใช้อาชีพ |

5. แถวแรกของชีตใหม่แต่ละชีตต้องเป็น `Party | Slot1 | Slot2 | Slot3 | Slot4 | Slot5` ไม่จำเป็นต้องสร้างแถวสมาชิกหรือทีมจำลอง กดเพิ่มปาร์ตี้ใน UI ได้สูงสุด 16 ทีม

คอลัมน์อาชีพใหม่เป็น optional ระหว่าง migration: ถ้าไม่มีคอลัมน์หรือค่าเป็นว่างจะคืน `''` และแสดง “ไม่ระบุอาชีพ” ไม่มี fallback ไป Guild League/Overrun
ถ้าชีตปาร์ตี้ยังไม่มี ระบบจะแสดงข้อผิดพลาดและปิดปุ่ม Save เพื่อไม่บันทึกข้อมูลเปล่าโดยไม่ได้โหลดก่อน

## Deploy ด้วยตนเอง

1. ตั้งค่าคอลัมน์และชีตตามข้างต้นก่อน โดยรักษาชีตเดิมทั้งหมด
2. เปิด Apps Script project ที่ให้บริการ API ปัจจุบัน แล้วอัปเดตไฟล์หลักด้วย `apps-script/รหัส.gs` ที่แก้แล้ว คง `statSubmissions.gs`, `discordMemberLinks.gs` และไฟล์อื่นที่ deployment เดิมใช้อยู่ ห้ามเพิ่ม doGet/doPost ซ้ำ
3. Deploy → Manage deployments → Edit Web App เดิม → New version → Deploy ใช้สิทธิ์/การเข้าถึงเดิม การอัปเดต deployment เดิมช่วยให้ URL `/exec` ไม่เปลี่ยน
4. ทดสอบ GET แบบอ่านอย่างเดียว `?action=members&forceRefresh=1` ว่ามีฟิลด์อาชีพครบและ ID/IGN เดิม จากนั้น `?action=party&sheet=StellarClash&forceRefresh=1` (ทำซ้ำ ValeOfClash/VigridAvenge) ควรได้รายการว่างถ้ายังไม่บันทึก
5. Build frontend ด้วย `npm run typecheck` และ `npm run build` แล้ว deploy Vercel ด้วยขั้นตอนปกติของโปรเจกต์ด้วยตนเอง หากเปลี่ยน deployment URL ต้องตั้ง `VITE_GOOGLE_API_URL` ให้ตรงก่อน build; bot ไม่ต้องเปลี่ยน URL เมื่อใช้ deployment เดิม
6. เปิดหน้า Party Builder แล้วโหลดสมาชิกใหม่เพื่อข้าม frontend cache เดิม Apps Script เปลี่ยน members cache key เป็น v2 เพื่อไม่คืน schema เก่า

ไม่มีการ deploy หรือ migration อัตโนมัติจากการแก้โค้ดครั้งนี้

## การตรวจสอบ

รัน `node scripts/party-builder.test.mjs` เพื่อทดสอบ App handlers และ hooks จริงด้วย React/browser/Google Sheets จำลอง ครอบคลุม:

- ทั้ง 6 โหมด: class mapping ไม่ fallback, legacy member payload, คอลัมน์สลับตำแหน่ง/คอลัมน์ใหม่ขาดหาย
- Drag & Drop, swap สมาชิก/ทีม, remove, clear ทีม/ทั้งหมด, Undo/Redo
- draft และประวัติแยกตามโหมด, Save/Load แยกชีต, โหลดทับ draft แล้ว Undo, request ตอบกลับสลับลำดับ
- Apps Script บันทึกชีตหนึ่งโดยชีตโหมดอื่นและข้อมูลสมาชิกไม่เปลี่ยน
- Screenshot handlers: พื้นที่ภาพมีชื่อโหมด, ชื่อไฟล์ PNG ถูกต้อง, เรียกเส้นทาง download/clipboard ครบทุกโหมด

ชุดทดสอบใช้ข้อมูลจำลองเท่านั้น ไม่ใช่การยืนยัน Google deployment จริงหรือการ render PNG ในเบราว์เซอร์จริง
หลัง deploy ให้ตรวจบนเบราว์เซอร์กับข้อมูลจริง: สลับครบ 6 โหมด, ตรวจอาชีพจากแถวสมาชิกจริง, ลาก/swap/remove/undo/redo/clear, Save แล้วโหลดเฉพาะโหมด, ตรวจทุกชีตอื่นว่ายังคงเดิม และเปิดภาพดาวน์โหลด/วาง clipboard เพื่อตรวจรูปกับชื่อโหมด รวมทั้ง layout ของแท็บบนจอแคบ


## ไฟล์ที่แก้ไข/เพิ่ม

- `src/App.tsx` — selector 6 โหมดและเชื่อม draft/history เข้ากับ handlers เดิม
- `src/constants/partyModes.ts` — mapping โหมด/ชื่อชีต/ฟิลด์อาชีพแบบรวมศูนย์
- `src/types/member.ts` — ขยาย PartyMode และเพิ่มฟิลด์อาชีพแบบ optional เพื่อรองรับ payload เก่า
- `src/hooks/usePartyBuilder.ts` — draft, loading/error และ request generation แยกโหมด
- `src/models/partyHistory.ts` — ประวัติแก้ไขและ Undo/Redo
- `src/hooks/useParties.ts` — ใช้ mapping ชื่อชีตร่วมกัน (War Planner ยังคงโหลด GuildLeague เหมือนเดิม)
- `src/services/googleApi.ts` — type ของชื่อชีตรองรับโหมดใหม่
- `src/components/party/PartyBoard.tsx` — อาชีพตามโหมด, Undo/Redo, ชื่อปุ่ม/หัวข้อภาพและดาวน์โหลด PNG
- `src/components/member/MemberPanel.tsx` — อาชีพตามโหมดและตัวเลือก sort
- `src/components/member/MemberList.tsx` — อาชีพตามโหมดโดยไม่มี fallback
- `src/styles/base.css` — แท็บโหมดขึ้นบรรทัดใหม่ได้
- `src/styles/party.css` — หัวข้อโหมดใน capture area
- `apps-script/รหัส.gs` — optional member column mapping, whitelist ชีตใหม่, members cache v2
- `apps-script/README.md`, `apps-script/party-builder-modes.md` — คู่มือตั้งค่า/deploy/ทดสอบ
- `scripts/party-builder.test.mjs` — regression tests แบบจำลอง ไม่มีการเข้าถึงข้อมูลจริง

ไม่ได้แก้ implementation ของ Auction, Attendance, War Planner หรือ Member Stats
Lint เฉพาะไฟล์ TypeScript/TSX และ test ที่แก้ผ่าน; lint ทั้ง repository ยังมีข้อผิดพลาดเดิมในไฟล์นอกขอบเขตงานนี้
