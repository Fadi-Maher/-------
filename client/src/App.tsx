import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { MaalamatiAssistant } from "./components/MaalamatiAssistant";
import { AnnouncementBar } from "./components/AnnouncementBar";
import { AuthModal } from "./components/AuthModal";
import { BrandWelcome, WelcomePage } from "./components/BrandWelcome";
import Account from "./pages/Account";
import About from "./pages/About";
import CustomersDashboard from "./pages/CustomersDashboard";
import CustomerDetail from "./pages/CustomerDetail";
import Contact from "@/pages/Contact";
import CustomerSignup from "@/pages/CustomerSignup";
import CustomerAccount from "@/pages/CustomerAccount";
import EmployeesDashboard from "@/pages/EmployeesDashboard";
import AuditDashboard from "@/pages/AuditDashboard";
import TeamLogin from "@/pages/TeamLogin";
import TeamWorkspace from "@/pages/TeamWorkspace";
import TeamRequestDetail from "@/pages/TeamRequestDetail";
import AccessLogin from "@/pages/AccessLogin";
import AgentLogin from "@/pages/AgentLogin";
import AgentJoinInfo from "@/pages/AgentJoinInfo";
import OwnerLogin from "@/pages/OwnerLogin";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import RequestSettings from "./pages/RequestSettings";
import AssistantKnowledge from "./pages/AssistantKnowledge";
import NotificationSettings from "./pages/NotificationSettings";
import RequestsDashboard from "./pages/RequestsDashboard";
import TrackRequest from "./pages/TrackRequest";
import TermsAndConditions from "./pages/TermsAndConditions";
import RefundAndCancellation from "./pages/RefundAndCancellation";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/welcome"} component={WelcomePage} />
      <Route path={"/account"} component={Account} />
      <Route path={"/about"} component={About} />
      <Route path={"/contact"} component={Contact} />
      <Route path={"/customer-signup"} component={CustomerSignup} />
      <Route path={"/customer-account"} component={CustomerAccount} />
      <Route path={"/owner-login"} component={OwnerLogin} />
      <Route path={"/team-login"} component={TeamLogin} />
      <Route path={"/login"} component={AccessLogin} />
      <Route path={"/agent-login"} component={AgentLogin} />
      <Route path={"/join-as-agent"} component={AgentJoinInfo} />
      <Route path={"/agent-dashboard"} component={TeamWorkspace} />
      <Route path={"/employee-dashboard"} component={TeamWorkspace} />
      <Route path={"/team-request/:requestId"} component={TeamRequestDetail} />
      <Route path={"/dashboard"} component={RequestsDashboard} />
      <Route path={"/employees"} component={EmployeesDashboard} />
      <Route path={"/agents"} component={EmployeesDashboard} />
      <Route path={"/audit"} component={AuditDashboard} />
      <Route path={"/customers/:id"} component={CustomerDetail} />
      <Route path={"/customers"} component={CustomersDashboard} />
      <Route path={"/settings"} component={RequestSettings} />
      <Route path={"/settings/assistant"} component={AssistantKnowledge} />
      <Route path={"/settings/notifications"} component={NotificationSettings} />
      <Route path={"/track"} component={TrackRequest} />
      <Route path={"/terms-and-conditions"} component={TermsAndConditions} />
      <Route path={"/refund-and-cancellation"} component={RefundAndCancellation} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider
          defaultTheme="light"
          // switchable
        >
          <TooltipProvider>
            <Toaster />
            <AnnouncementBar />
            <Router />
            <MaalamatiAssistant />
            <BrandWelcome />
            <AuthModal />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
