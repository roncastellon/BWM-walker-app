import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { MessageCircle, Send, Users, User, Filter, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const MessagesPage = () => {
  const { user, api, isAdmin, isWalker, isClient } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [contactFilter, setContactFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef(null);
  const pollInterval = useRef(null);
  const inputRef = useRef(null);
  const hasMarkedRead = useRef(false);

  useEffect(() => {
    fetchContacts();
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [contactFilter]);

  useEffect(() => {
    if (selectedContact || isGroupChat) {
      hasMarkedRead.current = false;
      fetchMessages();
      pollInterval.current = setInterval(fetchMessagesOnly, 5000);
    }
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [selectedContact, isGroupChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchContacts = async () => {
    try {
      const response = await api.get(`/messages/contacts?contact_type=${contactFilter}`);
      setContacts(response.data);
    } catch (error) {
      console.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages and mark as read (only on first load)
  const fetchMessages = async () => {
    try {
      let url = '/messages';
      if (isGroupChat) {
        url += '?group=true';
        if (!hasMarkedRead.current) {
          api.post('/messages/mark-read?mark_group=true').catch(() => {});
          hasMarkedRead.current = true;
        }
      } else if (selectedContact) {
        url += `?receiver_id=${selectedContact.id}`;
        if (!hasMarkedRead.current) {
          api.post(`/messages/mark-read?sender_id=${selectedContact.id}`).catch(() => {});
          hasMarkedRead.current = true;
        }
      } else {
        return;
      }
      const response = await api.get(url);
      setMessages(response.data.reverse());
    } catch (error) {
      console.error('Failed to load messages');
    }
  };

  // Fetch messages only (for polling, no mark-read)
  const fetchMessagesOnly = async () => {
    try {
      let url = '/messages';
      if (isGroupChat) {
        url += '?group=true';
      } else if (selectedContact) {
        url += `?receiver_id=${selectedContact.id}`;
      } else {
        return;
      }
      const response = await api.get(url);
      setMessages(response.data.reverse());
    } catch (error) {
      console.error('Failed to load messages');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageToSend = newMessage.trim();
    setNewMessage('');
    
    try {
      await api.post('/messages', {
        receiver_id: isGroupChat ? null : selectedContact?.id,
        is_group_message: isGroupChat,
        content: messageToSend,
      });
      fetchMessagesOnly();
    } catch (error) {
      toast.error('Failed to send message');
      setNewMessage(messageToSend);
    }
  };

  const handleInputChange = useCallback((e) => {
    setNewMessage(e.target.value);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    return date.toLocaleDateString();
  };

  const getContactTypeBadge = (type) => {
    switch (type) {
      case 'client':
        return <Badge className="bg-blue-100 text-blue-800 rounded-full text-xs">Client</Badge>;
      case 'walker':
        return <Badge className="bg-green-100 text-green-800 rounded-full text-xs">Walker</Badge>;
      case 'admin':
        return <Badge className="bg-purple-100 text-purple-800 rounded-full text-xs">Admin</Badge>;
      default:
        return null;
    }
  };

  const getFilterOptions = () => {
    if (isClient) {
      return [{ value: 'all', label: 'My Contacts' }];
    }
    return [
      { value: 'all', label: 'All Contacts' },
      { value: 'clients', label: 'My Clients' },
      { value: 'team', label: 'Team' },
    ];
  };

  const selectContact = (contact) => {
    setSelectedContact(contact);
    setIsGroupChat(false);
    setShowChat(true);
  };

  const selectGroupChat = () => {
    setSelectedContact(null);
    setIsGroupChat(true);
    setShowChat(true);
  };

  const goBackToContacts = () => {
    setShowChat(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  // Contacts List Component
  const ContactsList = () => (
    <Card className="h-full rounded-2xl shadow-sm flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Contacts</CardTitle>
        </div>
        {!isClient && (
          <Select value={contactFilter} onValueChange={setContactFilter}>
            <SelectTrigger className="mt-2" data-testid="contact-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getFilterOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-2">
        {(isAdmin || isWalker) && (
          <button
            onClick={selectGroupChat}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors mb-2 ${
              isGroupChat ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
            data-testid="group-chat-btn"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isGroupChat ? 'bg-primary-foreground/20' : 'bg-secondary/10'
            }`}>
              <Users className={`w-5 h-5 ${isGroupChat ? 'text-primary-foreground' : 'text-secondary'}`} />
            </div>
            <div className="text-left">
              <p className="font-medium">All (Team Broadcast)</p>
              <p className={`text-xs ${isGroupChat ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                Message entire backend team
              </p>
            </div>
          </button>
        )}

        {contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {contactFilter === 'clients' 
                ? 'No clients on your schedule yet'
                : 'No contacts available'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => selectContact(contact)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  selectedContact?.id === contact.id && !isGroupChat
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
                data-testid={`contact-${contact.id}`}
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={contact.profile_image} />
                  <AvatarFallback>{contact.full_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium truncate">{contact.full_name}</p>
                  <div className={`text-xs ${
                    selectedContact?.id === contact.id && !isGroupChat
                      ? 'text-primary-foreground/70'
                      : ''
                  }`}>
                    {selectedContact?.id === contact.id && !isGroupChat ? (
                      <span className="capitalize">{contact.type}</span>
                    ) : (
                      getContactTypeBadge(contact.type)
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Chat Area Component
  const ChatArea = ({ isMobile }) => (
    <Card className="h-full rounded-2xl shadow-sm flex flex-col">
      {selectedContact || isGroupChat ? (
        <>
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={goBackToContacts}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              {isGroupChat ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Team Chat</CardTitle>
                    <CardDescription>Staff communication channel</CardDescription>
                  </div>
                </>
              ) : (
                <>
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={selectedContact?.profile_image} />
                    <AvatarFallback>{selectedContact?.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{selectedContact?.full_name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {getContactTypeBadge(selectedContact?.type)}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwn = msg.sender_id === user?.id;
                  const showDate = idx === 0 || 
                    formatDate(messages[idx - 1]?.created_at) !== formatDate(msg.created_at);
                  
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="text-center text-xs text-muted-foreground my-4">
                          {formatDate(msg.created_at)}
                        </div>
                      )}
                      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${isOwn ? 'order-2' : ''}`}>
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-muted rounded-bl-sm'
                            }`}
                          >
                            {isGroupChat && !isOwn && (
                              <p className="text-xs font-medium mb-1 opacity-70">
                                {msg.sender_name}
                              </p>
                            )}
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? 'text-right' : ''}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border">
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="flex-1 rounded-full"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                data-testid="message-input"
              />
              <Button 
                type="submit" 
                size="icon" 
                className="rounded-full shrink-0" 
                disabled={!newMessage.trim()}
                data-testid="send-btn"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Select a contact</p>
            <p className="text-sm">Choose from the list to start chatting</p>
          </div>
        </div>
      )}
    </Card>
  );

  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] flex flex-col" data-testid="messages-page">
        <div className="mb-4">
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Messages</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            {isClient ? 'Chat with your assigned walker' : 'Chat with clients and team members'}
          </p>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex flex-1 gap-6 min-h-0">
          <div className="w-80 shrink-0">
            <ContactsList />
          </div>
          <div className="flex-1 min-w-0">
            <ChatArea isMobile={false} />
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="flex md:hidden flex-1 min-h-0">
          {!showChat ? (
            <div className="w-full">
              <ContactsList />
            </div>
          ) : (
            <div className="w-full">
              <ChatArea isMobile={true} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MessagesPage;
