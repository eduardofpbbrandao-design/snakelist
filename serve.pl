use strict; use warnings;
use IO::Socket::INET;
my $s = IO::Socket::INET->new(LocalAddr=>'127.0.0.1', LocalPort=>8099, Listen=>16, ReuseAddr=>1)
  or die "listen: $!";
$| = 1;
print "serving :8099\n";
while (my $c = $s->accept) {
  my $req = <$c> // next;
  my ($path) = $req =~ m{^GET\s+(\S+)};
  $path = '/' unless defined $path;
  $path =~ s/\?.*//;
  $path = '/snakelist-synced.html' if $path eq '/';
  $path =~ s{\.\.}{}g;
  while (my $l = <$c>) { last if $l =~ /^\r?$/ }
  my $file = ".$path";
  if (-f $file) {
    my $type = $file =~ /\.html$/ ? 'text/html; charset=utf-8'
             : $file =~ /\.css$/  ? 'text/css'
             : $file =~ /\.js$/   ? 'application/javascript'
             : $file =~ /\.png$/  ? 'image/png' : 'application/octet-stream';
    open my $h, '<:raw', $file or next;
    local $/; my $body = <$h>; close $h;
    print $c "HTTP/1.1 200 OK\r\nContent-Type: $type\r\nContent-Length: " . length($body) .
             "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n" . $body;
  } else {
    print $c "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
  }
  close $c;
}
