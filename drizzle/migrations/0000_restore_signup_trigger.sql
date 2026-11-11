-- The remixed database kept handle_new_user but lost its trigger on auth.users: new sign-ups got no profile, rating or wallet.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();