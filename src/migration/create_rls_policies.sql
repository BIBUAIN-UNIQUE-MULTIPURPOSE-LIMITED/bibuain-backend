-- Policies for migrations table (typically only admins should access this)
CREATE POLICY "Allow service role access to migrations" 
ON public.migrations
USING (auth.role() = 'service_role');

-- Policies for banks table
CREATE POLICY "Allow authenticated users to read banks" 
ON public.banks
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage banks" 
ON public.banks
USING (auth.role() = 'service_role');

-- Policies for message_templates table
CREATE POLICY "Allow authenticated users to read message templates" 
ON public.message_templates
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage message templates" 
ON public.message_templates
USING (auth.role() = 'service_role');

-- Policies for rates table
CREATE POLICY "Allow authenticated users to read rates" 
ON public.rates
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage rates" 
ON public.rates
USING (auth.role() = 'service_role');

-- Policies for accounts table
CREATE POLICY "Allow users to read their own accounts" 
ON public.accounts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow users to manage their own accounts" 
ON public.accounts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own accounts" 
ON public.accounts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Allow service role to manage all accounts" 
ON public.accounts
USING (auth.role() = 'service_role');

-- Policies for roles table
CREATE POLICY "Allow authenticated users to read roles" 
ON public.roles
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage roles" 
ON public.roles
USING (auth.role() = 'service_role');

-- Policies for role_permissions table
CREATE POLICY "Allow authenticated users to read role permissions" 
ON public.role_permissions
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage role permissions" 
ON public.role_permissions
USING (auth.role() = 'service_role');

-- Policies for permissions table
CREATE POLICY "Allow authenticated users to read permissions" 
ON public.permissions
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage permissions" 
ON public.permissions
USING (auth.role() = 'service_role');

-- Policies for users table
CREATE POLICY "Allow users to read all user profiles" 
ON public.users
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow users to update their own profile" 
ON public.users
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Allow service role to manage all users" 
ON public.users
USING (auth.role() = 'service_role');

-- Policies for shifts table
CREATE POLICY "Allow users to read shifts" 
ON public.shifts
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow users to manage their own shifts" 
ON public.shifts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own shifts" 
ON public.shifts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Allow service role to manage all shifts" 
ON public.shifts
USING (auth.role() = 'service_role');

-- Policies for notifications table
CREATE POLICY "Allow users to read their own notifications" 
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow service role to manage all notifications" 
ON public.notifications
USING (auth.role() = 'service_role');

-- Policies for chats table
CREATE POLICY "Allow chat participants to read chats" 
ON public.chats
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_participants.chat_id = chats.id
    AND chat_participants.user_id = auth.uid()
));

CREATE POLICY "Allow authenticated users to create chats" 
ON public.chats
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage all chats" 
ON public.chats
USING (auth.role() = 'service_role');

-- Policies for messages table
CREATE POLICY "Allow chat participants to read messages" 
ON public.messages
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_participants.chat_id = messages.chat_id
    AND chat_participants.user_id = auth.uid()
));

CREATE POLICY "Allow users to send messages to chats they participate in" 
ON public.messages
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_participants
        WHERE chat_participants.chat_id = messages.chat_id
        AND chat_participants.user_id = auth.uid()
    ) 
    AND auth.uid() = user_id
);

CREATE POLICY "Allow users to update their own messages" 
ON public.messages
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Allow service role to manage all messages" 
ON public.messages
USING (auth.role() = 'service_role');

-- Policies for activity_logs table
CREATE POLICY "Allow users to read their own activity logs" 
ON public.activity_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow service role to manage all activity logs" 
ON public.activity_logs
USING (auth.role() = 'service_role');

-- Policies for trades table
CREATE POLICY "Allow users to read their own trades" 
ON public.trades
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow users to manage their own trades" 
ON public.trades
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own trades" 
ON public.trades
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Allow service role to manage all trades" 
ON public.trades
USING (auth.role() = 'service_role');

-- Policies for chat_participants table
CREATE POLICY "Allow users to see chats they participate in" 
ON public.chat_participants
FOR SELECT
USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.chat_id = chat_participants.chat_id
    AND cp.user_id = auth.uid()
));

CREATE POLICY "Allow authenticated users to add themselves to chats" 
ON public.chat_participants
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow service role to manage all chat participants" 
ON public.chat_participants
USING (auth.role() = 'service_role');