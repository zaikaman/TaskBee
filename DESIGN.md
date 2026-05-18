---
name: "TaskBee"
description: "Hệ giao diện product cho marketplace nhiệm vụ nhỏ minh bạch tại Việt Nam."
colors:
  trust-green: "#22ab59"
  trust-green-hover: "#005924"
  trust-green-soft: "#e7faef"
  admin-ink: "#203259"
  main-charcoal: "#30394d"
  body-ink: "#1b1b1b"
  cool-paper: "#f5f7fa"
  cool-paper-raised: "#f8fafc"
  cool-paper-muted: "#f2f4f7"
  cool-border: "#d3dae6"
  hairline: "#f0f2f5"
  secondary-text: "#686d77"
  quiet-text: "#4a5568"
  warning-soft: "#fff3cf"
  warning-strong: "#de9100"
  danger: "#e63e46"
  danger-soft: "#fce3e5"
typography:
  display:
    fontFamily: "Roboto, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "normal"
  headline:
    fontFamily: "Roboto, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Roboto, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "normal"
  body:
    fontFamily: "Roboto, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Roboto, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.trust-green}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.trust-green-hover}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.main-charcoal}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.body-ink}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
    height: "32px"
  badge-success:
    backgroundColor: "{colors.trust-green-soft}"
    textColor: "{colors.trust-green}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
---

# Design System: TaskBee

## 1. Overview

**Creative North Star: "Sổ Cái Gọn Gàng"**

TaskBee dùng một hệ giao diện giống sổ vận hành tài chính nhỏ: rõ dòng tiền, rõ trạng thái, ít trang trí, thao tác nhanh. Sản phẩm phục vụ các luồng có tiền thật, ký quỹ, bằng chứng và kiểm duyệt, nên giao diện phải tạo niềm tin bằng cấu trúc trước khi dùng màu sắc hay hiệu ứng.

Register chính là product. Thiết kế cần quen thuộc như một công cụ vận hành tốt: top nav rõ, form gọn, bảng dễ quét, trạng thái có nhãn và bằng chứng hiển thị có trật tự. TaskBee không cần tạo cảm giác xa hoa; nó cần tạo cảm giác mọi khoản tiền và mọi quyết định đều có dấu vết.

Hệ này từ chối app kiếm tiền rẻ tiền, dashboard crypto tối màu, landing page SaaS chung chung, quá nhiều gradient và phong cách quá trẻ con. Mỗi màn hình phải đọc được nhanh trên mobile, có tương phản đạt WCAG AA và không dùng màu sắc làm tín hiệu duy nhất.

**Key Characteristics:**

- Sạch, sáng, có kiểm soát; nền trung tính lạnh, accent xanh dùng tiết chế.
- Dày vừa phải cho thao tác thật: form, bảng, ví tiền, danh sách việc và trạng thái duyệt.
- Gần với shadcn/radix-nova: component quen thuộc, radius nhỏ đến vừa, focus ring rõ.
- Tiếng Việt rõ nghĩa, có dấu, ưu tiên nhãn trực tiếp hơn copy quảng bá.

## 2. Colors

Bảng màu là restrained product palette: xanh tin cậy làm accent chính, xanh mực và than làm chữ, neutral lạnh làm bề mặt, warning/danger dùng cho trạng thái thật.

### Primary

- **Xanh Tin Cậy**: màu hành động chính, trạng thái tích cực, CTA tạo việc hoặc tìm việc, và điểm nhấn active có liên quan trực tiếp đến thao tác.
- **Xanh Tin Cậy Đậm**: hover hoặc trạng thái nhấn của primary action; không dùng làm nền trang lớn.
- **Xanh Tin Cậy Nhạt**: nền badge, trạng thái thành công và vùng nhấn nhẹ quanh luồng đã hợp lệ.

### Secondary

- **Xanh Mực Quản Trị**: dùng cho tiêu đề, nav, admin shell và các vùng cần cảm giác nghiêm túc.
- **Than Chữ Chính**: dùng cho heading, tên nhiệm vụ, số tiền quan trọng và nội dung có trọng lượng.

### Tertiary

- **Vàng Cảnh Báo Mềm**: dùng cho trạng thái đang chờ, pending, auto-approve hoặc cảnh báo nhẹ.
- **Đỏ Kiểm Soát**: dùng cho lỗi, từ chối, khoá tài khoản, nguy cơ mất tiền hoặc hành động destructive.

### Neutral

- **Nền Giấy Lạnh**: nền app, vùng dashboard và các panel cấp thấp.
- **Nền Giấy Nổi**: bề mặt sáng hơn cho navbar, card và vùng nhập liệu cần nổi lên khỏi nền.
- **Nền Giấy Mờ**: chip, table hover, footer card và vùng phụ.
- **Viền Lạnh**: border thường cho card, input, table, nav mobile.
- **Đường Tóc**: separator rất nhẹ giữa các vùng nội dung.
- **Chữ Phụ**: mô tả, metadata, nhãn thứ cấp và placeholder.

### Named Rules

**The Money First Rule.** Màu xanh chỉ được dùng mạnh cho hành động hoặc trạng thái có ích cho luồng công việc; không dùng xanh như trang trí nền tràn lan.

**The No Crypto Dark Rule.** Không chuyển các dashboard tiền, ví hoặc admin sang nền tối kiểu crypto, neon hoặc đầu cơ.

## 3. Typography

**Display Font:** Roboto với fallback hệ thống.
**Body Font:** Roboto với fallback hệ thống.
**Label/Mono Font:** Roboto Mono chỉ dùng khi cần chuỗi kỹ thuật, mã giao dịch hoặc nội dung có tính máy.

**Character:** Một sans duy nhất giúp TaskBee có cảm giác công cụ thật, không editorial và không quảng cáo. Trọng lượng 500, 700 và 900 tạo phân cấp, nhưng body vẫn phải đọc nhẹ trên mobile.

### Hierarchy

- **Display** (900, 2.25rem, 1.1): dùng cho hero hoặc tiêu đề trang có nhiệm vụ định hướng lớn; không dùng trong card nhỏ.
- **Headline** (700, 1.875rem, 1.2): dùng cho tiêu đề dashboard, wallet, admin và màn hình tạo việc.
- **Title** (500, 1rem, 1.375): dùng cho card title, field group, table section và menu item chính.
- **Body** (400, 0.875rem, 1.5): dùng cho mô tả nhiệm vụ, hướng dẫn, lỗi và nội dung phụ; prose dài giữ khoảng 65 đến 75 ký tự mỗi dòng.
- **Label** (700, 0.75rem, 1.25): dùng cho badge, nhãn trạng thái, metadata và nhãn form ngắn.

### Named Rules

**The Plain Vietnamese Rule.** Không dùng copy mơ hồ hoặc tiếng Việt không dấu trong UI; nhãn phải nói rõ người dùng cần làm gì hoặc trạng thái đang là gì.

**The No Display Labels Rule.** Không dùng chữ hero-scale trong form, badge, button, table hoặc nav.

## 4. Elevation

TaskBee dùng triết lý **Phẳng có lớp**: độ sâu chủ yếu đến từ nền, border, ring và khoảng cách; shadow chỉ xuất hiện nhẹ ở dropdown, popover, mockup landing và card cần tách khỏi nền. Bề mặt mặc định không cần đổ bóng nặng.

### Shadow Vocabulary

- **Popover Lift** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): dùng cho dropdown, select content và menu nổi.
- **Admin Tile Lift** (`box-shadow: 0 2px 12px rgba(32, 50, 89, 0.06)`): dùng cho metric tile hoặc card dashboard cần tách nhẹ khỏi nền.
- **Landing Mockup Lift** (`box-shadow: 0 22px 70px rgba(32, 50, 89, 0.12)`): chỉ dùng cho mockup marketing, không dùng trong app shell hằng ngày.

### Named Rules

**The Flat By Default Rule.** Card và panel đứng yên phải dùng border/ring trước; shadow nặng là dấu hiệu sai giọng.

## 5. Components

### Buttons

- **Shape:** góc gọn, quen thuộc, ưu tiên 8px; size nhỏ 6 đến 8px theo shadcn.
- **Primary:** nền Xanh Tin Cậy, chữ trắng, cao 32px cho UI dày vừa; landing CTA có thể cao 40 đến 64px khi là hành động chính.
- **Hover / Focus:** hover đậm hơn hoặc nền muted; focus dùng ring 3px để đạt WCAG AA và hỗ trợ keyboard.
- **Secondary / Ghost / Tertiary:** dùng border lạnh hoặc nền muted, không đổi sang màu bão hoà khi không phải trạng thái active.

### Chips

- **Style:** pill 20px, padding 2px 8px, chữ 12px hoặc 10px uppercase khi là nhãn category.
- **State:** success dùng Xanh Tin Cậy Nhạt; pending dùng Vàng Cảnh Báo Mềm; destructive dùng Đỏ Kiểm Soát Nhạt. Luôn có chữ trạng thái, không chỉ dựa vào màu.

### Cards / Containers

- **Corner Style:** card hệ thống dùng 12px; card landing cũ dùng 7px nhưng màn hình product mới nên chuẩn hoá về 8 đến 12px.
- **Background:** nền sáng hoặc Nền Giấy Nổi trên Nền Giấy Lạnh.
- **Shadow Strategy:** border/ring trước, shadow chỉ khi cần nổi lên.
- **Border:** dùng Viền Lạnh hoặc ring foreground 10%.
- **Internal Padding:** 12px cho card nhỏ, 16px cho card thường, 24px cho vùng dashboard lớn.

### Inputs / Fields

- **Style:** cao 32px, radius 8px, border Viền Lạnh, nền trong suốt hoặc sáng.
- **Focus:** border chuyển sang ring và thêm ring 3px; không chỉ đổi màu border.
- **Error / Disabled:** error dùng Đỏ Kiểm Soát kèm mô tả; disabled giảm opacity và đổi cursor, không xoá nhãn.

### Navigation

- **Style:** top nav sticky, nền sáng, border dưới rõ; active state dùng chữ xanh và underline/border-bottom 2px.
- **Typography:** nav dùng 14px, 500 đến 700, không dùng display font.
- **Mobile:** nav chuyển thành hàng chip cuộn ngang, vùng bấm đủ lớn, trạng thái active có nền hoặc border ngoài màu.

### Tables

- **Style:** bảng 14px, header 40px, cell padding 12px, row border nhẹ.
- **State:** hover dùng nền muted 50%; selected dùng muted rõ hơn; số tiền căn phải khi có thể.
- **Use:** ưu tiên cho admin, lịch sử ví, giao dịch, danh sách người dùng và submission review.

## 6. Do's and Don'ts

### Do:

- **Do** dùng Xanh Tin Cậy cho primary action, active nav và trạng thái tích cực có liên quan trực tiếp đến workflow.
- **Do** hiển thị số tiền, phí, escrow, pending balance và deadline bằng cấu trúc rõ trước khi thêm mô tả.
- **Do** dùng border, nền neutral và spacing để phân lớp; shadow chỉ dùng khi bề mặt thật sự nổi.
- **Do** viết toàn bộ nội dung UI bằng tiếng Việt có dấu, cụ thể và có thể hành động.
- **Do** kết hợp icon, text và label cho trạng thái để không phụ thuộc duy nhất vào màu sắc.
- **Do** giữ mobile là bề mặt hạng nhất: button đủ cao, nav cuộn ngang rõ, form không vỡ dòng khó đọc.

### Don't:

- **Don't** làm TaskBee giống app kiếm tiền rẻ tiền, hứa hẹn quá mức hoặc tạo cảm giác lôi kéo.
- **Don't** làm dashboard crypto tối màu, neon, đầu cơ hoặc nặng hiệu ứng.
- **Don't** dùng landing page SaaS chung chung với hero, card và gradient quen thuộc.
- **Don't** dùng quá nhiều gradient, màu sắc trang trí hoặc hiệu ứng không phục vụ thao tác.
- **Don't** làm giao diện quá trẻ con, thiếu nghiêm túc khi hiển thị tiền, bằng chứng, trạng thái duyệt và quyết định của admin.
- **Don't** dùng border-left hoặc border-right lớn hơn 1px như vạch màu trang trí trên card, list item, alert hoặc callout.
- **Don't** dùng gradient text; nhấn mạnh bằng trọng lượng, kích thước hoặc cấu trúc.
