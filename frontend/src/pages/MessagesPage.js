import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import { MessageCircle, Send, Users, User } from 'lucide-react';
import { toast } from 'sonner';

const MessagesPage = () => {
  const { user, api, isAdmin, isWalker } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const pollInterval = useRef(null);

  useEffect(() => {
    fetchConversations();
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  useEffect(() => {
    if (selectedConversation || isGroupChat) {
      fetchMessages();
      // Poll for new messages every 3 seconds
      pollInterval.current = setInterval(fetchMessages, 3000);
    }
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [selectedConversation, isGroupChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const response = await api.get('/messages/conversations');
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      let url = '/messages';
      if (isGroupChat) {
        url += '?group=true';
      } else if (selectedConversation) {
        url += `?receiver_id=${selectedConversation.partner.id}`;
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

    try {
      await api.post('/messages', {
        receiver_id: isGroupChat ? null : selectedConversation?.partner?.id,
        is_group_message: isGroupChat,
        content: newMessage.trim(),
      });
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] flex flex-col" data-testid="messages-page">
        <div className="mb-6">
          <h1 className="text-3xl font-heading font-bold">Messages</h1>
          <p className="text-muted-foreground">Chat with your {isWalker || isAdmin ? 'team and clients' : 'walker'}</p>
        </div>

        <div className="flex-1 flex gap-6 min-h-0">
          {/* Conversations List */}
          <Card className="w-80 shrink-0 rounded-2xl shadow-sm hidden md:flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-2">
              {(isAdmin || isWalker) && (
                <button
                  onClick={() => {
                    setSelectedConversation(null);
                    setIsGroupChat(true);
                  }}
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
                    <p className="font-medium">Team Chat</p>
                    <p className={`text-xs ${isGroupChat ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      Staff communication
                    </p>
                  </div>
                </button>
              )}

              {conversations.length === 0 && !isAdmin && !isWalker ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.partner.id}
                      onClick={() => {
                        setSelectedConversation(conv);
                        setIsGroupChat(false);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        selectedConversation?.partner?.id === conv.partner.id && !isGroupChat
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      data-testid={`conversation-${conv.partner.id}`}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={conv.partner.profile_image} />
                        <AvatarFallback>{conv.partner.full_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-medium truncate">{conv.partner.full_name}</p>
                        <p className={`text-xs truncate ${
                          selectedConversation?.partner?.id === conv.partner.id && !isGroupChat
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        }`}>
                          {conv.last_message?.content || 'No messages'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="flex-1 rounded-2xl shadow-sm flex flex-col min-w-0">
            {selectedConversation || isGroupChat ? (
              <>
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex items-center gap-3">
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
                          <AvatarImage src={selectedConversation?.partner?.profile_image} />
                          <AvatarFallback>{selectedConversation?.partner?.full_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{selectedConversation?.partner?.full_name}</CardTitle>
                          <CardDescription className="capitalize">{selectedConversation?.partner?.role}</CardDescription>
                        </div>
                      </>
                    )}
                  </div>
                </CardHeader>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg, idx) => {
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
                                {!isOwn && isGroupChat && (
                                  <p className="text-xs font-medium mb-1 opacity-70">
                                    {msg.sender_name || 'Team Member'}
                                  </p>
                                )}
                                <p className="text-sm">{msg.content}</p>
                              </div>
                              <p className={`text-xs text-muted-foreground mt-1 ${isOwn ? 'text-right' : ''}`}>
                                {formatTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-4 border-t border-border">
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 rounded-full"
                      data-testid="message-input"
                    />
                    <Button type="submit" size="icon" className="rounded-full shrink-0" data-testid="send-message-btn">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a conversation</p>
                  <p className="text-sm">Choose from the list to start chatting</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default MessagesPage;
