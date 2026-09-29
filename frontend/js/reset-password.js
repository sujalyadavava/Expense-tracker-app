const form = document.getElementById("resetPasswordForm");
const message = document.getElementById("message");
const loginLink = document.getElementById("loginLink");

const urlParams = new URLSearchParams(window.location.search);
const rawToken = urlParams.get("token");
const token = rawToken ? rawToken.trim() : "";

if (!token) {
  message.textContent = "Missing reset token. Please request a new password reset link.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!token) {
    message.textContent = "Missing reset token. Please request a new password reset link.";
    return;
  }

  if (!password) {
    message.textContent = "Please enter a new password.";
    return;
  }
  if (!confirmPassword) {
    message.textContent = "Please confirm your new password.";
    return;
  }
  if (password !== confirmPassword) {
    message.textContent = "Passwords do not match.";
    return;
  }
  if (password.length < 6) {
    message.textContent = "Password must be at least 6 characters long.";
    return;
  }

  message.textContent = "Updating password...";
  const submitButton = form.querySelector("button[type='submit']");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Resetting...";
  }

  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Could not reset password.");
    }

    message.textContent = "Password reset successfully. You can now login.";
    form.reset();
    loginLink.hidden = false;
  } catch (error) {
    message.textContent = error.message;
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Reset Password";
    }
  }
});
