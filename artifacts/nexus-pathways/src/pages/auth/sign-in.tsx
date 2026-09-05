import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-4">
            <span className="font-bold text-xl">NP</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your Nexus Pathways account</p>
        </div>
        <div className="flex justify-center">
          <SignIn 
            routing="path" 
            path="/sign-in" 
            signUpUrl="/sign-up"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "w-full shadow-lg border-border rounded-xl",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
                footerActionLink: "text-primary hover:text-primary/90",
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}