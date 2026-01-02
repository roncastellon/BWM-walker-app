import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { 
  MessageSquare, Users, PawPrint, Send, Loader2, CheckCircle, 
  AlertCircle, Clock, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

const MassTextPage = () => {
  const { api } = useAuth();
  const [message, setMessage] = useState('');
  const [recipientGroup, setRecipientGroup] = useState('all');
  const [sending, setSending] = useState(false);
  const [recipientCounts, setRecipientCounts] = useState({ all: 0, clients: 0, walkers: 0 });
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [countsRes, historyRes] = await Promise.all([
        api.get('/admin/mass-text/recipients-count'),
        api.get('/admin/mass-text/history'),
      ]);
      setRecipientCounts(countsRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (message.length > 160) {
      toast.warning('Message exceeds 160 characters. It may be sent as multiple SMS.');
    }

    const recipientCount = recipientCounts[recipientGroup];
    if (recipientCount === 0) {
      toast.error('No recipients with phone numbers in this group');
      return;
    }

    setSending(true);
    try {
      const response = await api.post('/admin/mass-text', {
        recipient_group: recipientGroup,
        message: message.trim()
      });

      toast.success(`Message sent to ${response.data.sent_count} recipients`);
      
      if (response.data.failed_count > 0) {
        toast.warning(`${response.data.failed_count} messages failed to send`);
      }

      setMessage('');
      fetchData(); // Refresh history
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to send mass text';
      toast.error(errorMsg);
    } finally {
      setSending(false);
    }
  };

  const getGroupLabel = (group) => {
    switch (group) {
      case 'all': return 'All Users';
      case 'clients': return 'All Clients';
      case 'walkers': return 'All Walkers';
      default: return group;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
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
      <div className="max-w-3xl mx-auto space-y-6" data-testid="mass-text-page">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-primary" />
            Mass Text
          </h1>
          <p className="text-muted-foreground">Send SMS messages to your clients and walkers</p>
        </div>

        {/* Compose Card */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Compose Message</CardTitle>
            <CardDescription>Create and send a text message to multiple recipients</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recipient Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Send To</Label>
              <RadioGroup 
                value={recipientGroup} 
                onValueChange={setRecipientGroup}
                className="grid grid-cols-3 gap-3"
              >
                <Label
                  htmlFor="all"
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    recipientGroup === 'all' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="all" id="all" className="sr-only" />
                  <Users className="w-6 h-6 text-primary" />
                  <span className="font-medium text-sm">All Users</span>
                  <Badge variant="secondary" className="rounded-full">
                    {recipientCounts.all} recipients
                  </Badge>
                </Label>

                <Label
                  htmlFor="clients"
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    recipientGroup === 'clients' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="clients" id="clients" className="sr-only" />
                  <Users className="w-6 h-6 text-blue-600" />
                  <span className="font-medium text-sm">Clients Only</span>
                  <Badge variant="secondary" className="rounded-full">
                    {recipientCounts.clients} recipients
                  </Badge>
                </Label>

                <Label
                  htmlFor="walkers"
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    recipientGroup === 'walkers' 
                      ? 'border-secondary bg-secondary/5' 
                      : 'border-muted hover:border-secondary/50'
                  }`}
                >
                  <RadioGroupItem value="walkers" id="walkers" className="sr-only" />
                  <PawPrint className="w-6 h-6 text-secondary" />
                  <span className="font-medium text-sm">Walkers Only</span>
                  <Badge variant="secondary" className="rounded-full">
                    {recipientCounts.walkers} recipients
                  </Badge>
                </Label>
              </RadioGroup>
            </div>

            {/* Message Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message" className="text-base font-medium">Message</Label>
                <span className={`text-xs ${message.length > 160 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {message.length}/160 characters
                </span>
              </div>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="mass-text-input"
              />
              {message.length > 160 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Messages over 160 characters may be split into multiple SMS
                </p>
              )}
            </div>

            {/* Send Button */}
            <Button 
              onClick={handleSend} 
              disabled={sending || !message.trim() || recipientCounts[recipientGroup] === 0}
              className="w-full rounded-full"
              size="lg"
              data-testid="send-mass-text-btn"
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending to {recipientCounts[recipientGroup]} recipients...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Send to {recipientCounts[recipientGroup]} {getGroupLabel(recipientGroup)}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* History Section */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader 
            className="cursor-pointer"
            onClick={() => setShowHistory(!showHistory)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  Message History
                </CardTitle>
                <CardDescription>View previously sent mass texts</CardDescription>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
          {showHistory && (
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No messages sent yet</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="p-4 rounded-xl bg-muted/50 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium line-clamp-2">{item.message}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full shrink-0">
                          {getGroupLabel(item.recipient_group)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          {item.sent_count} sent
                        </span>
                        {item.failed_count > 0 && (
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertCircle className="w-3 h-3" />
                            {item.failed_count} failed
                          </span>
                        )}
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </Layout>
  );
};

export default MassTextPage;
