export const REAL_PROMPTS = [
  {
    id: "P01",
    prompt: "Build a CRM with login, contacts list, dashboard with stats, role-based access for admin and sales reps, and Stripe payments. Admins can see analytics.",
    expected_entities: ["User", "Contact", "Deal", "Plan", "Payment"],
    expected_roles: ["admin", "sales_rep"],
    expected_pages_min: 4,
  },
  {
    id: "P02",
    prompt: "E-commerce store with product catalog, shopping cart, checkout with payment, order history, and admin panel for managing inventory and orders.",
    expected_entities: ["Product", "Order", "Cart", "User", "Category"],
    expected_roles: ["admin", "customer"],
    expected_pages_min: 5,
  },
  {
    id: "P03",
    prompt: "Project management tool with boards, tasks, team members, due dates, file attachments, and activity log.",
    expected_entities: ["Board", "Task", "User", "Attachment"],
    expected_roles: ["admin", "member"],
    expected_pages_min: 3,
  },
  {
    id: "P04",
    prompt: "Hospital appointment booking system. Patients book appointments with doctors, doctors manage schedules, admins manage the system.",
    expected_entities: ["Patient", "Doctor", "Appointment", "Schedule"],
    expected_roles: ["patient", "doctor", "admin"],
    expected_pages_min: 4,
  },
  {
    id: "P05",
    prompt: "SaaS analytics dashboard with multiple data sources, custom charts, scheduled reports, team sharing, and subscription tiers.",
    expected_entities: ["DataSource", "Chart", "Report", "User", "Subscription"],
    expected_roles: ["admin", "analyst", "viewer"],
    expected_pages_min: 4,
  },
  {
    id: "P06",
    prompt: "Food delivery app. Customers order from restaurants, restaurants manage menus, delivery drivers pick up and deliver orders.",
    expected_entities: ["Customer", "Restaurant", "Order", "Driver", "MenuItem"],
    expected_roles: ["customer", "restaurant_owner", "driver", "admin"],
    expected_pages_min: 5,
  },
  {
    id: "P07",
    prompt: "HR management system with employee profiles, leave management, payroll tracking, performance reviews, and org chart.",
    expected_entities: ["Employee", "LeaveRequest", "Payroll", "Review", "Department"],
    expected_roles: ["hr_admin", "manager", "employee"],
    expected_pages_min: 5,
  },
  {
    id: "P08",
    prompt: "Real estate listing platform. Agents post properties, buyers search and save listings, request viewings, admin approves listings.",
    expected_entities: ["Property", "Agent", "Buyer", "Viewing"],
    expected_roles: ["admin", "agent", "buyer"],
    expected_pages_min: 4,
  },
  {
    id: "P09",
    prompt: "Online learning platform with courses, video lessons, quizzes, progress tracking, certificates, and instructor dashboard.",
    expected_entities: ["Course", "Lesson", "Quiz", "User", "Certificate"],
    expected_roles: ["admin", "instructor", "student"],
    expected_pages_min: 5,
  },
  {
    id: "P10",
    prompt: "Inventory management system for a warehouse. Track products, stock levels, incoming and outgoing orders, suppliers, and generate reports.",
    expected_entities: ["Product", "StockItem", "Order", "Supplier"],
    expected_roles: ["admin", "warehouse_staff", "manager"],
    expected_pages_min: 4,
  },
];

export const EDGE_PROMPTS = [
  {
    id: "E01",
    prompt: "Build an app",
    type: "too_vague",
    expected_behavior: "clarification_requested",
  },
  {
    id: "E02",
    prompt: "Free premium plan with payments but no cost to users ever",
    type: "conflicting",
    expected_behavior: "conflict_detected_and_resolved",
  },
  {
    id: "E03",
    prompt: "Admin can see everything but also cannot see anything sensitive",
    type: "logical_conflict",
    expected_behavior: "conflict_detected_and_resolved",
  },
  {
    id: "E04",
    prompt: "Build Twitter but 10x better",
    type: "vague_ambitious",
    expected_behavior: "clarification_requested_or_reasonable_assumption",
  },
  {
    id: "E05",
    prompt: "App with login but no users",
    type: "incomplete",
    expected_behavior: "auto_assumption_users_table",
  },
  {
    id: "E06",
    prompt: "CRM",
    type: "single_word",
    expected_behavior: "clarification_requested",
  },
  {
    id: "E07",
    prompt: "I want something that helps my team manage work, communicate, track time, handle projects, tasks, calendar, share files, chat, notifications, billing and subscriptions.",
    type: "overspecified",
    expected_behavior: "success_with_prioritization",
  },
  {
    id: "E08",
    prompt: "All users are admins and no one is a regular user",
    type: "conflicting_roles",
    expected_behavior: "single_role_resolved",
  },
  {
    id: "E09",
    prompt: "App for managing things",
    type: "too_generic",
    expected_behavior: "clarification_requested",
  },
  {
    id: "E10",
    prompt: "Marketplace where sellers sell products but buyers can also sell and everyone is both buyer and seller but only admins can be sellers initially",
    type: "complex_conflicting_roles",
    expected_behavior: "conflict_detected_assumption_documented",
  },
];

export interface EvaluationResult {
  prompt_id: string;
  prompt: string;
  prompt_type: "real" | "edge";
  success: boolean;
  status: "success" | "partial" | "failed" | "clarification";
  clarification_triggered: boolean;
  repair_triggered: boolean;
  repair_attempts: number;
  repairs_succeeded: number;
  validation_errors_found: number;
  latency_ms: number;
  ai_calls_made: number;
  assumptions_made: number;
  conflicts_detected: number;
  failure_reason: string | null;
}